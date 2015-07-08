var moment = require('moment');
moment().format();

//console.log(moment()));
var now = moment();
console.log(moment().add({seconds : 30}).format("YYYY-MM-DD HH:mm:ss"));
console.log(new Date(2015, 05, 05, 11, 30, 12));
var bool = 1;
bool = !bool;
console.log(bool);
bool = !bool;
console.log(Number(bool));