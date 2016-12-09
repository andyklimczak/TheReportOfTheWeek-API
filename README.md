[![Build Status](https://travis-ci.org/andyklimczak/TheReportOfTheWeek-API.svg?branch=master)](https://travis-ci.org/andyklimczak/TheReportOfTheWeek-API)

# The Report Of The Week API

Basic API to provide information on [The Report Of The Week](https://www.youtube.com/user/TheReportOfTheWeek)

### Usage

* Check status:
  * GET /
* All reports (sorted by date):
  * GET /reports
* Reports by category
  * GET /reports?category=Energy Crisis
  * GET /reports?category=Running On Empty
* Reports between certain dates
  * GET /reports?between=2012-1-1|2013-1-1

## Development

0. Install mongodb, node, and npm
1. Clone the repo
2. __npm install__
3. __npm start__ will load the data and start the server
4. __npm test__ will run the tests

### Update data

The json information the server returns is created from seeds/reports.json. Information from new videos needs to be entered manually. Please feel free to update/append new data !
