[![Build Status](https://travis-ci.org/andyklimczak/project-x-server.svg?branch=master)](https://travis-ci.org/andyklimczak/project-x-server)

# The Report Of The Week API

Basic API to provide information on [The Report Of The Week](https://www.youtube.com/user/TheReportOfTheWeek)

### Usage

* Check status:
  * GET https://report-server.herokuapp.com
* All reports (sorted by date):
  * GET https://report-server.herokuapp.com/reports

## Development

0. Install mongodb, node, and npm
1. Clone the repo
2. __npm install__
3. __npm start__ will load the data and start the server
4. __npm test__ will run the tests
