const express = require('express')
const mongoose = require('mongoose')

const Data = require('./models/Data');
const LocationSchema = require('./models/location');
const carStatusSchema = require('./models/carStatus');

const app = express()
const port = 5004;

const report = require('./report');


/**
 * You need to use bodyParser() if you want the form data to be available in req.body.
 */
/*app.use(bodyParser.text({defaultCharset:'windows-1252'}))
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());*/

app.use(function(req, res, next){
    var data = "";
    req.setEncoding('hex');
    req.on('data', function(chunk){
        data = chunk;
    })
    req.on('end', function(){
        req.rawBody = data;
        //req.jsonBody = JSON.parse(data);
        next();
    })
 });

 app.use('/report', report);


mongoose
  .connect("mongodb://10.19.1.8:27017/electricVehicle", { useNewUrlParser: true , useUnifiedTopology: true, useFindAndModify:false})
  .then(() => {

    console.log('MongoDB Connected');
    const client = mongoose.connection.client;
    let db = client.db('electricVehicle');

    const dataCollection = db.collection('datas');
    const carStatusCollection = db.collection('carstatuses');

    const changeStream = dataCollection.watch();
    changeStream.on('change', next=>{
        
        if(next.operationType === 'insert'){console.log("Data inserted", next.fullDocument.carID);

            LocationSchema
            .findOneAndUpdate({carID: next.fullDocument.carID}, {carStatus: 1})
            .then(() => {
            })
            .catch(err => {
                console.log("LocationSchema save error: " + err);
            });

            carStatusSchema.findOneAndUpdate(
                {
                    _id: next.fullDocument.carID
                },
                {
                    _id: next.fullDocument.carID,
                    carID: next.fullDocument.carID
                },
                {
                    new: true,
                    upsert: true
                }
            )
            .then(() => {
            })
            .catch(err => {
                console.log("carStatusCollection save error: " + err);
            });
        }
            
    });

    const carStatusChangeStream = carStatusCollection.watch();
    carStatusChangeStream.on('change', next=>{
        if(next.operationType === 'delete'){
            
            LocationSchema
            .findOneAndUpdate(

                {carID: next.documentKey._id}, 
                {carStatus: 0}

            ).then((doc) =>{
                console.log(doc);
            });
        }
            
    });
  })
  .catch(err => console.log(err));


const start = Date.now();

// Record data
app.post('/data', (req, res) => {


    const millis = Date.now() - start;
    console.log(`seconds elapsed = ${Math.floor(millis / 1000)}`);
    
    const CARID = req.rawBody.substring(0, 6);
    const LOCATION = req.rawBody.substring(6, 22);
    let LONGITUDE = LOCATION.substring(0, 8);
    let LATITUDE = LOCATION.substring(8, 16);

    let LONGITUDE_tmp = '0X' + LOCATION.substring(0, 8);
    let LATITUDE_tmp = '0X' + LOCATION.substring(8, 16); 

    //The data is valid
    if((LONGITUDE_tmp.replace(/'/g, '') <= 0X25F3CA4 && LONGITUDE_tmp.replace(/'/g, '') >= 0X17E8C50) 
           && (LATITUDE_tmp.replace(/'/g, '') <= 0X3C43AFE && LATITUDE_tmp.replace(/'/g, '') >= 0X29F75A2)){
        console.log('Location is valid.')
        LocationSchema.findOneAndUpdate(
            {
                carID: CARID
            },
            {
                longitude: LONGITUDE,
                latitude: LATITUDE,
                carStatus: 1
            },
            {
                new: true,
                upsert: true
            }
        )
        .then(() => {
            
        })
        .catch(err => {
            console.log("LocationData save error: " + err);
        });
    }

    

    const newData = new Data({
        data: req.rawBody,
        carID: CARID,
        date_in: Date.now()
    });

    newData
    .save()
    .then(() => {
        res.status(200).send("OK")
    }  
    )
    .catch(err => {
		console.log(err);
        res.status(404).json(err);
    });
});

// Get last n data
app.post('/getdata', (req, res) => {
    Data.find({})
    .then(data => {
        if ( !Number.isInteger(req.body.n) || req.body.n<0 ) return res.status(404).send("Invalid");
        res.status(200).json(data.slice(data.length-req.body.n))
    })
    .catch(err => res.status(404).json(err));
})



// // Get last data
app.get('/lastdata', (req, res) => {
    Data.find({})
    .then(data => {
        res.status(200).json(data[data.length-1])
    })
    .catch(err => res.status(404).json(err));
})



app.get('/', (req, res) => {
    Data.find({})
    .then(data => {
        res.status(200).json(data[data.length-1])
    })
    .catch(err => res.status(404).json(err));
})


app.listen(port, () => console.log(`Server Running on port ${port}`))