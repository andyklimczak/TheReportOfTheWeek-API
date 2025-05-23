# The Report of the Week API

API to provide information on reviews by [The Report of the Week](https://www.youtube.com/user/TheReportOfTheWeek)

## Endpoints & Docs

Checkout the [OpenAPI Docs](https://thereportoftheweekapi.com/docs) for more info and to test the endpoints.

The base URL is `https://www.thereportoftheweek.com`.

## Data

This API returns all reviews done on The Report of the Week youtube channel.
All the reviews live in the [reports.json file](./data/reports.json) if you're just interested pulling in the data into your own datastore..

### Example Review

```json
{
  "product": "5 Hour Energy Pomegranate",
  "manufacturer": "Living Essentials",
  "category": "Energy Crisis",
  "videoTitle": "Energy Crisis--Energy Drink Review",
  "videoCode": "wyD3nCv_emI",
  "dateReleased": "2011-02-20",
  "rating": 7.0,
  "id": "0b399d91-1673-4708-ba60-f1312b037b35"
}
```

## Local Setup

In the project directory, you can run:

### `npm run dev`

To start the app in dev mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm start`

For production mode

### `npm run test`

Run the test cases.
