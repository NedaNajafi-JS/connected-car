// const axios = require('axios');
const request = require('request');

module.exports = function sendsms(number, code, patterncode){
    request.post({
        url: 'http://ippanel.com/api/select',
        body: {
    "op":"pattern",
    "user":"09124607657",
    "pass":"2669895433",
    "fromNum":"3000505",
    "toNum":number,
    "patternCode":patterncode,//"m3lv2766gr",
    "inputData":[
        {"code":code}	
    ]
    },
        json: true,
    }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
    //YOU‌ CAN‌ CHECK‌ THE‌ RESPONSE‌ AND SEE‌ ERROR‌ OR‌ SUCCESS‌ MESSAGE
            console.log(response.body);
    } else {
        console.log("whatever you want");
    }
    });
}