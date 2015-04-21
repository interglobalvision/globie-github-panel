var CronJob = require('cron').CronJob;
var randomNumber = require('random-number');
var Trello = require("node-trello");
var ForecastIo = require('forecastio');
var Mailgun = require('mailgun').Mailgun;
var moment = require('moment');

var latitude = process.env.LATITUDE;
var longitude = process.env.LONGITUDE;


// SETUP MAILGUN

var mailgun = new Mailgun(process.env.MAILGUN_KEY);


// SETUP TRELLO ACCESS

var trelloKey = process.env.TRELLO_KEY;
var trelloToken = process.env.TRELLO_TOKEN;

var trello = new Trello(trelloKey, trelloToken);


// SETUP NUMBER GENERATOR

var randomNumberOptions = {
  min:  1,
  max:  6,
  integer: true
}
var getRandom = randomNumber.generator(randomNumberOptions)


// SETUP FORECAST.IO

var forecastIoOptions = {
  units: 'si'
};
var forecastIo = new ForecastIo(process.env.FORECASTIO_KEY);


// SETUP CRON

var job = new CronJob({
  cronTime: '00 30 10 * * 1-5',
  onTick: function() {

    // this is where the good stuff happens
    var todaysBriefing = new Briefing();
    todaysBriefing.getActiveProjects();
    todaysBriefing.getWeatherForecast();
    todaysBriefing.specificDay();
    todaysBriefing.inSpanishDay();
    todaysBriefing.send();

  },
  start: true,
  timeZone: 'America/Mexico_City'
});

job.start();


// THE BRIEFING OBJECT

function Briefing() {

  this.output = {
    day: '',
    weather: '',
    projects: '',
    language: ''
  },

  this.getActiveProjects = function() {

    var _this = this;

/*
    trello.get('/1/organizations/intgblvsn', { boards: 'open' }, function(err, data) {
      if (err) {
        throw err;
      }
      console.log(data);
    });
*/

    // general board
/*
    trello.get('/1/boards/545c25db2196338ba228b5aa', { lists: 'open' }, function(err, data) {
      if (err) {
        throw err;
      }
      console.log(data.lists);
    });
*/

    var projectReport = 'These projects are active: ';

    // active projects list
    trello.get('/1/lists/547536fcd467d6175c3f600d', { cards: 'open' }, function(err, data) {
      if (err) {
        throw err;
      }

      var index;
      for (index = 0; index < data.cards.length; ++index) {
//         console.log(data.cards[index].name);
        projectReport += data.cards[index].name;
        if (index !== (data.cards.length - 1)) {
          projectReport += ', ';

        }
      }

      projectReport += '. So crack on then.';

//       console.log(projectReport);
      _this.output.projects = projectReport;

    });

  },

  this.getWeatherForecast = function() {

    var _this = this;
    var weatherReport = '';

    forecastIo.forecast(latitude, longitude, forecastIoOptions, function(err, data) {
      if (err) {
        throw err;
      }
/*
      console.log(JSON.stringify(data, null, 2));
      console.log(data.currently);
      console.log(data.hourly.summary);
*/

      if (data.currently.apparentTemperature > 27) {
        weatherReport += 'Its already hot at ' + data.currently.apparentTemperature + 'c so drink up thy water today I tell ee.';
      } else {
        weatherReport += 'The temperature is ' + data.currently.apparentTemperature + 'c.';
      }

      weatherReport += ' The forecast for the rest of the day is: ' + data.hourly.summary;

//       console.log(weatherReport);
      _this.output.weather = weatherReport;

    });


  },

  this.specificDay = function() {

    var day = moment().days();

    if (day === 1) {
      // monday
      this.output.day = 'Yes it\'s monday. So timesheets today everyone plz. Lets not overrun projects.';

    } else if (day === 3) {
      // wednesday
      this.output.day = 'REMEMBER today we should prioritize Internal Projects. I don\'t just want to be famous for portfolio work.';

    } else if (day === 5) {
      // friday
      this.output.day = 'tbh why are you even here? If you are you should remember to clock off early.';

    }


  },

  this.inSpanishDay = function() {
    if (getRandom() === 1) {
      this.output.language = 'Bad luck Pat & Miley, today is Spanish Day. Life: the spanish version';
    } else {
      this.output.language = 'Lo siento Cas: today is White People Rights Day so we speak American English.';
    }
  },

  this.send = function() {

    var _this = this;

    // this is where we build the message
    var waitForRequests = setTimeout(function() {

//       console.log(_this.output);

      var mailContent = '';

      for(var prop in _this.output) {
        if(_this.output.hasOwnProperty(prop))
          mailContent += _this.output[prop] + ' \n\n';
      }

      console.log(mailContent);

      mailgun.sendText('globie@interglobal.vision', 'globie@interglobal.vision', 'Globie\'s daily report', mailContent, null, null, function(err) {
        console.log(err);
      });

    }, 3000)

  }

}


// DEV

/*
var testBriefing = new Briefing();
testBriefing.getActiveProjects();
testBriefing.getWeatherForecast();
testBriefing.specificDay();
testBriefing.inSpanishDay();
testBriefing.send();
*/