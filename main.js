require('dotenv').load();
var Promise = require('promise');

var CronJob = require('cron').CronJob;
var randomNumber = require('random-number');
var Trello = require("node-trello");
var Mailgun = require('mailgun').Mailgun;
var moment = require('moment');
var i18n = require("i18n");

var EmailTemplate = require('email-templates').EmailTemplate;
var path = require('path');
var templateDir = path.join(__dirname, 'templates', 'daily');

var latitude = process.env.LATITUDE;
var longitude = process.env.LONGITUDE;

// SETUP i18n
i18n.configure({
  locales:['en', 'es'],
  directory: __dirname + '/locales',
  defaultLocale: 'en',
});

// SETUP MAILGUN

var mailgun = new Mailgun(process.env.MAILGUN_KEY);


// SETUP TRELLO ACCESS

var trelloKey = process.env.TRELLO_KEY;
var trelloToken = process.env.TRELLO_TOKEN;

var trello = new Trello(trelloKey, trelloToken);


// SETUP GITHUB

var GitHubApi = require('github');

var github = new GitHubApi({
  // required
  version: '3.0.0',
  // optional
  debug: false,
});
github.authenticate({
  type: 'basic',
  username: process.env.GITHUB_USER,
  password: process.env.GITHUB_PASSWORD
});


// SETUP NUMBER GENERATOR

var randomNumberOptions = {
  min:  1,
  max:  4,
  integer: true,
}
var getRandom = randomNumber.generator(randomNumberOptions)


// REWRITE OBJECT

var Briefing = function() {

  this.output = {
    day: undefined,
    projects: undefined,
    issues: undefined,
    language: undefined,
    weather: undefined,
  },

  this.init = function() {
    var _this = this;

    if (process.env.DEBUG === 'TRUE') {

      _this.send();

    } else {

      _this.setupCron();

    }

  },

  this.setupCron = function() {
    var _this = this;

    _this.job = new CronJob({
      cronTime: '00 30 08 * * 1-5',
      onTick: function() {

        _this.send();

      },
      start: true,
      timeZone: 'America/Mexico_City'
    });

    _this.job.start();

  },

  this.send = function() {
    var _this = this;

    _this.clearData();
    _this.setLangage();
    _this.setDate();
    _this.setData()

  },

  this.clearData = function() {
    var _this = this;

    _this.output = {
      day: undefined,
      projects: undefined,
      issues: undefined,
      language: undefined,
      weather: undefined,
    };

  },

  this.setLangage = function() {
    var _this = this;

    if (getRandom() === 1) {
      i18n.setLocale('es');
      _this.output.language = 'es';
    } else {
      i18n.setLocale('en');
      _this.output.language = 'en';
    }

  },

  this.setDate = function() {
    var _this = this;
    var day = moment().days();

    if (day === 1) {
      // monday
       _this.output.day = i18n.__('Yes it\'s monday. So timesheets today everyone plz. Lets not overrun projects.');
    } else if (day === 2) {
      // tuesday
      _this.output.day = i18n.__('Remember today we should prioritize Internal Projects. I don\'t just want to be famous for portfolio work.');
    } else if (day === 3) {
      // wednesday
      _this.output.day = i18n.__('Cleaning day so scrub that tub [etc] and get in ASAP!');
    } else if (day === 5) {
      // friday
      _this.output.day = i18n.__('tbh why are you even here? If you are you should remember to clock off early.');
    }

  },

  this.setData = function() {
    var _this = this;

    Promise.all([_this.getSomeProjects(), _this.getSomeIssues()]).then(function(res) {
      Promise.all([_this.buildProjectsText(), _this.buildIssuesText()]).then(function(res) {

        _this.generateMail();

      });
    });

  },

  this.getSomeProjects = function() {
    var _this = this;

    return new Promise(function(resolve, reject) {

      // active projects list
      trello.get('/1/lists/547536fcd467d6175c3f600d', { cards: 'open' }, function(err, res) {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          _this.someProjects = res;
          resolve(res);
        }

      });

    });

  },

  this.buildProjectsText = function() {
    var _this = this;

    return new Promise(function(resolve, reject) {
      var projectsArray = new Array();
      var i = 0;

      _this.someProjects.cards.forEach(function(card) {

        projectsArray.push(card);

        i++;

      });

      _this.output.projects = projectsArray;

      resolve(projectsArray);

    });

  },

  this.getSomeIssues = function() {
    var _this = this;

    return new Promise(function(resolve, reject) {

      github.issues.getAll({
        id: 6844994,
        filter: 'all',
        state: 'open',
        per_page: 10,
      }, function(err, res) {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          _this.someIssues = res;
          resolve(res);
        }
      });
    });

  },

  this.buildIssuesText = function() {
    var _this = this;

    return new Promise(function(resolve, reject) {
      var issues = new Array();
      var i = 0;

      _this.someIssues.forEach(function(issue) {

        if (!issue.pull_request && i < 10) {

          issues.push(issue);

          i++;

        }

      });

      _this.output.issues = issues;

      resolve(issues);

    });

  },

  this.generateMail = function() {
    var _this = this;
    var dailyEmail = new EmailTemplate(templateDir);

    dailyEmail.render(_this.output, function (err, result) {

      if (err) {
        console.log(err);
      }

      if (process.env.DEBUG !== 'TRUE') {

        console.log('Sending Mail');
        _this.sendMail(result);

      } else {

        console.log('HTML Mail to send:', result.html);

      }

    });

  },

  this.sendMail = function(mail) {

    mailgun.sendRaw('globie@interglobal.vision', 'globie@interglobal.vision',
      'From: globie@interglobal.vision' +
      '\nTo: ' + 'globie@interglobal.vision' +
      '\nContent-Type: text/html; charset=utf-8' +
      '\nSubject: Globie\'s daily report' +
      '\n' + mail.html,
      function(err) {
        if (err) {
          console.log(err);
        }
      }
    );

  },

  this.init()

};

var GlobiesBriefing = new Briefing();