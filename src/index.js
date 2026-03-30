const axios = require("axios");

// ===== CONFIG =====
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ===== HELPERS =====
function getNext7Dates() {
  const dates = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date("2026-04-04 00:00:00");
    //d.setHours(d.getHours() + 5);
    d.setDate(d.getDate() + i);

    const formatted = d.toLocaleDateString("en-GB").replace(/\//g, "%2F");
    dates.push(formatted);
  }

  return dates;
}

// ===== FETCH =====
async function fetchIsrair(url) {
  //const url = `https://www.israir.co.il/api/search/FLIGHTS?origin=%7B%22type%22%3A%22ltravelId%22%2C%22destinationType%22%3A%22CITY%22%2C%22cityCode%22%3A%22TLV%22%2C%22ltravelId%22%3A2135%2C%22countryCode%22%3Anull%2C%22countryId%22%3Anull%7D&destination=undefined&startDate=${date}&adults=2&children=2%2C2&subject=ALL&sessionMetadata=%7B%22clientKey%22%3A%7B%22clientId%22%3A%22bot%22%7D%7D&siteId=isra2023`;

  const res = await axios.post(
    url,
    {
      ignoredResults: 0,
      siteId: "isra2023"
    },
    {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
      },
      timeout: 10000
    }
  );

  return res.data;
}

// ===== PARSER =====
function extractFlights(data) {
  const matches = [];

  const packages =
    data?.data?.ltsPackages || [];

  packages.forEach(pkg => {
    const price =
      pkg?.packageFare?.passengerFares?.[0]?.amount?.amount || 0;

    const currency =
      pkg?.packageFare?.passengerFares?.[0]?.amount?.currency || "";

    pkg.legGroups?.forEach(group => {
      group.legList?.forEach(leg => {
        leg.legOptionList?.forEach(option => {
          option.legSegmentList?.forEach(segment => {
            const seats = parseInt(segment.seats || "0", 10);

            if (seats >= 4) {
              matches.push({
                flightNumber: segment.flightNumber,
                dep: segment.depLoc,
                arr: segment.arrLoc,
                seats,
                price,
                currency
              });
            }
          });
        });
      });
    });
  });

  return matches;
}

// ===== TELEGRAM =====
async function sendTelegram(messages) {
  for (const msg of messages) {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: msg
      }
    );
  }
}

// ===== FORMAT =====
function buildMessages(flights) {
  if (flights.length === 0) return [];

  let msg = "✈ Israir seat alert (4+ seats)\n\n";

  flights.forEach(f => {
    msg += `Flight ${f.flightNumber}\n`;
    msg += `${f.dep.location} → ${f.arr.location}\n`;
    msg += `${f.dep.scheduledDateTime} → ${f.arr.scheduledDateTime}\n`;
    msg += `Seats: ${f.seats}\n`;
    msg += `Price: ${f.price} ${f.currency}\n\n`;
  });

  return [msg];
}

// ===== MAIN =====
async function main() {
  console.log("Starting Israir check...");

  const dates = getNext7Dates();
  let allFlights = [];

  for (const date of dates) {
    try {
      console.log("Checking:", date);

      let urls = [`https://www.israir.co.il/api/search/FLIGHTS?origin=%7B%22type%22%3A%22IATA%22%2C%22destinationType%22%3A%22CITY%22%2C%22cityCode%22%3A%22ATH%22%2C%22ltravelId%22%3Anull%2C%22countryCode%22%3Anull%2C%22countryId%22%3Anull%7D&destination=%7B%22type%22%3A%22ltravelId%22%2C%22destinationType%22%3A%22CITY%22%2C%22cityCode%22%3A%22TLV%22%2C%22ltravelId%22%3A768%2C%22countryCode%22%3Anull%2C%22countryId%22%3Anull%7D&startDate=${date}&adults=2&children=2%2C2&searchTime=2026-03-30T21%3A37%3A44.349Z&sessionMetadata=%7B%22clientKey%22%3A%7B%22clientId%22%3A%22f383e516-b7f8-48ad-aae9-71291aef1289-1774902808760%22%7D%2C%22useMockData%22%3Afalse%2C%22debug%22%3Afalse%7D&siteId=isra2023`,
                 `https://www.israir.co.il/api/search/FLIGHTS?origin=%7B%22type%22%3A%22ltravelId%22%2C%22destinationType%22%3A%22CITY%22%2C%22cityCode%22%3A%22LCA%22%2C%22ltravelId%22%3A931%2C%22countryCode%22%3Anull%2C%22countryId%22%3Anull%7D&destination=%7B%22type%22%3A%22ltravelId%22%2C%22destinationType%22%3A%22CITY%22%2C%22cityCode%22%3A%22TLV%22%2C%22ltravelId%22%3A768%2C%22countryCode%22%3Anull%2C%22countryId%22%3Anull%7D&startDate=${date}&adults=2&children=2%2C2&searchTime=2026-03-30T21%3A47%3A00.984Z&sessionMetadata=%7B%22clientKey%22%3A%7B%22clientId%22%3A%22f383e516-b7f8-48ad-aae9-71291aef1289-1774902808760%22%7D%2C%22useMockData%22%3Afalse%2C%22debug%22%3Afalse%7D&siteId=isra2023`];
      for (const url of urls) {
        const data = await fetchIsrair(url);
        const flights = extractFlights(data);
  
        allFlights = allFlights.concat(flights);
      }
    } catch (err) {
      console.error("Error for date:", date, err.message);
    }
  }

  if (allFlights.length === 0) {
    console.log("No flights with 4+ seats found.");
    return;
  }

  const messages = buildMessages(allFlights);
  await sendTelegram(messages);

  console.log("Notification sent.");
}

main();
