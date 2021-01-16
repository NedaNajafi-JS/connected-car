/*'use strict';
const fs = require('fs');
const Https = require('https');*/

const WebSocket = require('ws');
const mongoose = require('mongoose')

const Data = require('./models/Data');
const LocationSchema = require('./models/location');
const profile = require('./models/profile');

let isEmpty = require('./is-empty');
const randomCodeModel = require('./models/randomCode');
const sendsms = require('./config/sms');

const jwt = require("jsonwebtoken");
const keys = require("./config/keys");

let db ='';
let dataCollection ='';
let carStatusCollection = '';
let interVal = '';

mongoose
  .connect("mongodb://10.19.1.8:27017/electricVehicle", { useNewUrlParser: true , useUnifiedTopology: true, useFindAndModify:false})
  .then(() => {

    console.log('MongoDB Connected');

    const client = mongoose.connection.client;
    db = client.db('electricVehicle');
    dataCollection = db.collection('datas');
    carStatusCollection = db.collection('carstatuses');

  });

/*const httpsServer = Https.createServer({
  cert: fs.readFileSync('/etc/pki/tls/certs/ca.crt'),
  key: fs.readFileSync('/etc/pki/tls/private/ca.key')
});*/
/*const wss = new WebSocket({
  server: httpsServer
});*/

/*httpsServer.on('request', (req, res) => {
  res.writeHead(200);
  res.end('hello\n');
});*/

const wss = new WebSocket.Server({ port: 5006 });
console.log('Socket listening to port 5006');

try{

  wss.on('connection', async function connection(ws, req) {

    console.log("A new connection.");
    
    const url = req.url.split('/');
    console.log('url', url);
    if (url.length > 1) ws.id = url[1];

    console.log('ws.id', ws.id);

    let locationTimer = '';
    interVal = function(miliSec){
  
      return setInterval(()=>{

        console.log("send getAllCars.");

        LocationSchema
        .find()
        .then(res => {

          let str ='';
          res.map(doc=>{
            
            if(doc.carID.length > 0){
              
              let carStatusHex = Buffer.from(doc.carStatus.toString(), 'utf8').toString('hex');
              
              str += doc.carID.toString() + doc.longitude.toString() + doc.latitude.toString() + carStatusHex.toString();
              str += '\n\r';

            }

          });

          if(ws.readyState === ws.OPEN){
            ws.send(str);
          }

        });

      }, miliSec);
    }

    ws.on('error', function(error){
      console.log("error: " + error);

      if(locationTimer)
        clearInterval(locationTimer);
    });

    ws.on('close', function(error){

      if(error){
        console.log("close error: " + error);
      }
        
      console.log('on close, socket id', ws.id);

      ws.close();
      ws.terminate();

      if(locationTimer)
        clearInterval(locationTimer);
    });

    let changeStream = '';
    let carStatusChangeStream = '';

    ws.on('message', async message => {

	      console.log("number of opened sockets: ", wss.clients.size);
        let data = JSON.parse(message);
        console.log("A new message.", data.action);

        if(data.action !== undefined){

          switch(data.action){

            case 'changeCarID':

              try{

                const decoded = await jwt.verify(
                  data.token.split(':')[1],
                  keys.secretOrKey,
                );

                const user = await profile.findOne(
                  {
                    phone: decoded.phone
                  }
                );

                if(user){

                  if(parseInt(data.id) === parseInt(ws.id)){

                    clearInterval(locationTimer);

                    if(data.carID.length > 0 || data.carID > 0){
                      ws.carID = data.carID;
                    }
                    
                    let pipeline = [
                      {
                        $match: { "fullDocument.carID": ws.carID }
                      }
                    ];
                    
                    changeStream = dataCollection.watch(pipeline);
                    changeStream.on('change', next=>{
                
                      if(next.operationType === 'insert' && 
                          next.fullDocument.carID === ws.carID && 
                          ws.readyState === ws.OPEN){

                        console.log('dataSending, carID: '+ ws.carID);
                        ws.send(next.fullDocument.data);

                      }
                
                    });

                    carStatusChangeStream = carStatusCollection.watch();
                    carStatusChangeStream.on('change', next=>{

                        if(next.operationType === 'delete' && 
                            next.documentKey._id === ws.carID && 
                            ws.readyState === ws.OPEN){
                            
                            console.log('the car is off');
                            ws.send(ws.carID.toString() + '30');                  
                        }
                            
                    });
                  }

                }
              
              }catch(err){
                console.log(err);
              }
            break;

            case 'stopSending':
              
              try{

                const decoded = await jwt.verify(
                  data.token.split(':')[1],
                  keys.secretOrKey,
                );

                const user = await profile.findOne(
                  {
                    phone: decoded.phone
                  }
                );

                if(user){

                  if(parseInt(data.id) === parseInt(ws.id)){

                    if(changeStream)
                      changeStream.cursor.removeAllListeners();

                    if(carStatusChangeStream)
                      carStatusChangeStream.cursor.removeAllListeners();

                  }
                
                }

              }catch(err){
                console.log(err);
              }

              break;

            case 'getAllCars':
              
              try{

                const decoded = await jwt.verify(
                  data.token.split(':')[1],
                  keys.secretOrKey,
                );

                const user = await profile.findOne(
                  {
                    phone: decoded.phone
                  }
                );

                if(user){

                  if(parseInt(data.id) === parseInt(ws.id)){

                    locationTimer = interVal(500);
  
                    if(changeStream)
                      changeStream.cursor.removeAllListeners();
  
                    if(carStatusChangeStream)
                      carStatusChangeStream.cursor.removeAllListeners();
  
                  }

                }else{
                  console.log('کاربری با این مشخصات یافت نشد.');
                }
                
                
              }catch(err){
                console.log(err);
              }
              
              break;

            case 'stopSendingStatus':

              try{

                const decoded = await jwt.verify(
                  data.token.split(':')[1],
                  keys.secretOrKey,
                );

                const user = await profile.findOne(
                  {
                    phone: decoded.phone
                  }
                );

                if(user){

                  if(parseInt(data.id) === parseInt(ws.id))
                    clearInterval(locationTimer);
                }

              }catch(err){
                console.log(err);
              }

              break;

            case 'startInterval':

              try{

                const decoded = await jwt.verify(
                  data.token.split(':')[1],
                  keys.secretOrKey,
                );

                const user = await profile.findOne(
                  {
                    phone: decoded.phone
                  }
                );

                if(user){

                  if(parseInt(data.id) === parseInt(ws.id))
                    locationTimer = interVal(500);

                }

              }catch(err){
                console.log(err);
              }

              break;

            case 'report':

              try{

                const decoded = await jwt.verify(
                  data.token.split(':')[1],
                  keys.secretOrKey,
                );

                const user = await profile.findOne(
                  {
                    phone: decoded.phone
                  }
                );

                if(user){

                  if(parseInt(data.id) === parseInt(ws.id)){

                    Data.find(
                      {
                        "date_in": {$gte: new Date(data.startDate), $lt:new Date(data.endDate) },
                        "carID": data.carID
                      }
                    )
                    .then(dataa => {
      
                        let str = '';
                        dataa.map(d =>{
      
                            str += '\n\r';
                            str += d.data;
      
                        });
            
                        if(str.length > 0 && ws.readyState === ws.OPEN){
                          ws.send(str);
                        }
      
                    })
                    .catch(err => console.log(err));

                  }

                }

              }catch(err){
                console.log(err);
              }

              break;
            case 'Login':

              profile.findOne(
                {
                  username: data.username,
                  password: data.password
                }
              )
              .then(prof => {

                if(prof){

                  const payload = {
                    id: prof._id,
                    phone: prof.phone
                  };
  
                  jwt.sign(
  
                    payload,
                    keys.secretOrKey, {
                      expiresIn: 3600 * 5
                    },
                    (err, token) => {
  
                      if(err){
  
                        console.log(err);
                        if(ws.readyState === ws.OPEN){
                          ws.send('LoginFailed');
                        }
  
                      }else{
  
                        if(ws.readyState === ws.OPEN){
  
                          ws.send("Bearer:" + token);
  
                        }
                      }
  
                    }
  
                  );

                }else{

                  if(ws.readyState === ws.OPEN){
                    ws.send('LoginFailed');
                  }

                }
                
              })
              .catch(err => {

                console.log(err);

                if(ws.readyState === ws.OPEN){
                  ws.send('LoginFailed');
                }

              });

              break;
            case 'RegisterUser':
                
              if(isEmpty(data.name) ||
                  isEmpty(data.familyName) ||
                  isEmpty(data.username) ||
                  isEmpty(data.password) ||
                  isEmpty(data.phone)
                ){
                  console.log('خطا در پارامترهای ورودی');
                  break;
                }
              
              const newUser = new profile({

                name: data.name,
                familyName:data.familyName,
                username:data.username,
                password: data.password,
                phone:data.phone,
                registerDate: Date.now()

              });

              newUser
              .save()
              .then(usr => {

                if(usr){
                  console.log('کاربر با موفقیت ثبت شد.');
                }
                
              })
              .catch(err => {
                console.log(err);
                console.log('خطا در ثبت کاربر');
              });

              break;

            case 'ForgetPassword':

              profile.findOne(
                {
                  phone: data.phone
                }
              )
              .then(user => {

                if(user){

                  let code = Math.floor(100000 + Math.random() * 900000);

                  randomCodeModel.findOneAndUpdate(
                    {
                      phone: user.phone
                    }, 
                    {
                      code:code
                    },
                    {
                        new: true,
                        upsert: true
                    }
                  )
                  .then((randomCode) => {

                    if(randomCode){
                      sendsms(user.phone, code.toString(), "m3lv2766gr");
                    }
                    
                  })
                  .catch(err => {
                    console.log(err);
                  });

                }else{
                  console.log('کاربر یافت نشد.');
                }

              })
              .catch(err => {
                console.log(err);
              })

              break;

            case 'ChangePassword':

              profile.findOne(
                {
                  phone: data.phone,
                  password: data.oldPassword
                }
              )
              .then(user => {

                if(user){

                  randomCodeModel.findOne(
                    {
                      phone: user.phone,
                      code: data.confirmCode
                    }
                  )
                  .then(rndmCode => {

                    if(rndmCode){

                      profile.findOneAndUpdate(
                        {
                          phone: user.phone
                        },
                        {
                          password: data.newPassword
                        }
                      )
                      .then(upUser => {

                        if(upUser){

                          if(ws.readyState === ws.OPEN){
                            ws.send('changePasswordSucceeded');
                          }

                        }else{

                          if(ws.readyState === ws.OPEN){
                            ws.send('changePasswordFailed');
                          }
                          
                        }
                      })
                      .catch(err => {

                        console.log(err);
                        if(ws.readyState === ws.OPEN){
                          ws.send('changePasswordFailed');
                        }

                      });

                    }else{

                      console.log('کد ارسالی اشتباه است.');
                      if(ws.readyState === ws.OPEN){
                        ws.send('changePasswordFailed');
                      }

                    }
                  })
                  .catch(err => {

                    console.log(err);

                    if(ws.readyState === ws.OPEN){
                      ws.send('changePasswordFailed');
                    }

                  });

                }else{
                  console.log('کاربری با این مشخصات یافت نشد.');
                }
              })
              break;

            case 'ChangePasswordAfterLogin':

              try{
                
                const decoded = await jwt.verify(
                  data.token.split(':')[1],
                  keys.secretOrKey,
                );
                
                profile.findOne(
                  {
                    phone: decoded.phone,
                    password: data.oldPassword
                  }
                )
                .then(user => {
                  
                  if(user){

                    profile.findOneAndUpdate(
                      {
                        phone: decoded.phone
                      },
                      {
                        password: data.newPassword
                      }
                    )
                    .then(upUser => {
  
                      if(upUser){
  
                        if(ws.readyState === ws.OPEN){
                          ws.send('changePasswordSucceeded');
                        }
  
                      }else{
  
                        if(ws.readyState === ws.OPEN){
                          ws.send('changePasswordFailed');
                        }
                            
                      }
                    })
                    .catch(err => {
  
                          console.log(err);
                          if(ws.readyState === ws.OPEN){
                            ws.send('changePasswordFailed');
                          }
  
                    });

                  }else{

                    if(ws.readyState === ws.OPEN){
                      ws.send('changePasswordFailed');
                    }
                    console.log('کاربری با این مشخصات یافت نشد.');

                  }
                })
                .catch(err => {
                  console.log(err);
                })

              }catch(err){
                console.log(err);
              }

              break;
          }
        }
    });

  });

}catch(err){
  console.log("ERROR= "+err);
}

//httpsServerhttpsServer.listen(5006);