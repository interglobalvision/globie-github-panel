require('dotenv').load();
var Promise = require('promise');

var CronJob = require('cron').CronJob;
var randomNumber = require('random-number');
var Trello = require("node-trello");
var Mailgun = require('mailgun').Mailgun;
var moment = require('moment');
var i18n = require("i18n");

var latitude = process.env.LATITUDE;
var longitude = process.env.LONGITUDE;

// SETUP i18n
i18n.configure({
  locales:['en', 'es'],
  directory: __dirname + '/locales',
  defaultLocale: 'es',
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


// SETUP CRON

var job = new CronJob({
  cronTime: '00 30 08 * * 1-5',
  onTick: function() {

    // this is where the good stuff happens
    var todaysBriefing = new Briefing();
    todaysBriefing.send();

  },
  start: true,
  timeZone: 'America/Mexico_City'
});

job.start();


// THE BRIEFING OBJECT

var Briefing = function() {

  if (getRandom() === 1) {
    i18n.setLocale('es');
  } 

  this.output = {
    day: '',
    projects: '',
    issues: '',
    language: '',
    weather: '',
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

      var projectReport = i18n.__('These projects are active') + ': \n\n';

      var i = 0;
      _this.someProjects.cards.forEach(function(card) {

        projectReport += card.name;

        if (i !== (_this.someProjects.cards.length - 1)) {
          projectReport += '\n';
        }

        i++;

      });

      projectReport += '\n\n' + i18n.__('So crack on then.');

      resolve(projectReport);

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

      var issuesText = i18n.__('Here are 5 Github issues for the day. Clean this list!') + '\n';

      var i = 0;
      _this.someIssues.forEach(function(issue) {

        if (!issue.pull_request && i < 5) {

          var issueText = '';

          issueText += i18n.__('\nIssue #%s on %s \n', issue.id, issue.repository.name);

          issueText += i18n.__('Title: %s \n', issue.title);

          issueText += i18n.__('Body: %s \n\n', issue.body);

          if (issue.assignee) {
            issueText += i18n.__('Assigned to @ %s! U bad do this ASAP!', issue.assignee.login) + '\n';
          }

          issueText += issue.html_url + '\n';

          issuesText += issueText;

          i++;

        }

      });

      resolve(issuesText);

    });

  },

  this.send = function() {
    var _this = this;

    Promise.all([_this.getSomeProjects(), _this.getSomeIssues()])
    .then(function(res) {
      Promise.all([_this.buildProjectsText(), _this.buildIssuesText()])
      .then(function(res) {
        var email = '';
        var day = moment().days();

        if (day === 1) {
          // monday
          email += i18n.__('Yes it\'s monday. So timesheets today everyone plz. Lets not overrun projects.');
        } else if (day === 2) {
          // tuesday
          email += i18n.__('Remember today we should prioritize Internal Projects. I don\'t just want to be famous for portfolio work.');
        } else if (day === 3) {
          // wednesday
          email += i18n.__('Cleaning day so scrub that tub [etc] and get in ASAP!');
        } else if (day === 5) {
          // friday
          email += i18n.__('tbh why are you even here? If you are you should remember to clock off early.');
        }

        email += ' \n\n----------\n\n';

        res.forEach(function(section) {
          email += section + ' \n\n----------\n\n';
        });

        email += 'Globie @ interglobal.vision :]'

        if (process.env.DEBUG === 'TRUE') {

          console.log(email);

        } else {

          mailgun.sendText('globie@interglobal.vision', 'globie@interglobal.vision', 'Globie\'s daily report', email, null, null, function(err) {
          if (err) {
            console.log(err);
          }
        });

      }

    });
  });

}

};


// DEV
if (process.env.DEBUG === 'TRUE') {
  var testBriefing = new Briefing();
  testBriefing.send();
}
