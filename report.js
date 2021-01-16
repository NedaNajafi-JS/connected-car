const Data = require('./models/Data');

const express = require('express');
const router = express();

// Get all data
router.post('/getReport', (req, res) => {
    let data = Buffer.from(req.rawBody,'hex').toString('utf8');
    if(data.length > 0)
        data = JSON.parse(data);console.log(data)
    if((data.startDate == undefined || data.startDate == '') &&
    (data.endDate == undefined || data.endDate == '')){
        Data.find().sort({_id:-1}).limit(2)
        .then(data => {console.log('data', data)
            let str = [];
            data.map(d =>{
                let obj = {};
                obj.data = d.data;
                obj.date = d.date_in;
                str.push(obj);
            });
            let result = str.reverse();
            res.status(200).send(result);
        })
        .catch(err => res.status(404).json(err));
    }else{
        if(data.startDate == undefined || data.startDate == ''){
            Data.find({"date":{$lte:new Date(data.endDate) }})
            .then(data => {
                let str = [];
                let obj = {};
                data.map(d =>{
                    obj.data = d.data;
                    obj.date = d.date_in;
                    str.push(obj);
                });
                res.status(200).send(str);
            })
            .catch(err => res.status(404).json(err));
        }else if(data.endDate == undefined || data.endDate == ''){
            Data.find({"date":{$gte: new Date(data.startDate)}})
            .then(data => {
                let str = [];
                let obj = {};
                data.map(d =>{
                    obj.data = d.data;
                    obj.date = d.date_in;
                    str.push(obj);
                });
                res.status(200).send(str);
            })
            .catch(err => res.status(404).json(err));
        }else{
            let start = new Date(data.startDate);//console.log(start.toLocaleDateString('fa-IR'))
            start = start.toISOString();

            let end = new Date(data.endDate);
            end = end.toISOString();

            console.log(start, end);
            
            Data.find({"date_in":{$gte: new Date(data.startDate), $lt:new Date(data.endDate) }})
            .then(dataa => {
                let str = [];
                
                dataa.map(d =>{
                    let obj = {};
                    obj.data = d.data;
                    obj.date = d.date_in;
                    str.push(obj);
                });
                let result = str.reverse();
                res.status(200).send(result);
            })
            .catch(err => res.status(404).json(err));
        }
    }
});

module.exports = router;