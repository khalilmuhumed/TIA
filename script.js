// Luodaan tyhjä olio aseman lyhenteiden ja kokonaisten nimien tallentamiseen
let stationMap = {};

// Haetaan kaikki asemat Digitraffic API:sta ja täytetään valintalistat (dropdownit)
fetch("https://rata.digitraffic.fi/api/v1/metadata/stations")
  .then(res => res.json()) // Muutetaan vastaus JSON-muotoon
  .then(data => {
    const fromSelect = document.getElementById("fromStation");
    const toSelect = document.getElementById("toStation");

    // Käydään läpi jokainen asema
    data.forEach(station => {
      // Lisätään vain matkustajaliikenteen asemat
      if (station.passengerTraffic) {
        // Tallennetaan aseman lyhenne ja koko nimi muistiin
        stationMap[station.stationShortCode] = station.stationName;

        // Luodaan vaihtoehto (option) lähtöasemalle
        const optionFrom = document.createElement("option");
        optionFrom.value = station.stationShortCode;
        optionFrom.textContent = station.stationName;
        fromSelect.appendChild(optionFrom);

        // Kopioidaan sama vaihtoehto määränpääasemalle
        const optionTo = optionFrom.cloneNode(true);
        toSelect.appendChild(optionTo);
      }
    });
  });

// Funktio, joka hakee junien aikataulut valittujen asemien perusteella
function fetchTrains(from, to) {
  const results = document.getElementById("results");
  results.innerHTML = "<p>Haetaan aikatauluja...</p>"; // Näytetään latausviesti

  // Haetaan lähtevät junat annetulta asemalta
  fetch(`https://rata.digitraffic.fi/api/v1/live-trains/station/${from}?arrived_trains=0&departed_trains=0&include_nonstopping=false`)
    .then(res => res.json())
    .then(data => {
      results.innerHTML = ""; // Tyhjennetään tulosalue
      const now = new Date(); // Nykyinen aika vertailua varten

      // Suodatetaan junat, jotka pysähtyvät molemmilla asemilla ja joiden lähtöaika on tulevaisuudessa
      const filtered = data.filter(train => {
        const hasFrom = train.timeTableRows.find(r => r.stationShortCode === from && r.type === "DEPARTURE");
        const hasTo = train.timeTableRows.find(r => r.stationShortCode === to && r.type === "ARRIVAL");

        if (!hasFrom || !hasTo) return false;

        const depTime = new Date(hasFrom.scheduledTime);
        return depTime > now;
      });

      // Jos junia ei löytynyt, näytetään ilmoitus
      if (filtered.length === 0) {
        results.innerHTML = "<p>Ei tulevia junia löytynyt.</p>";
        return;
      }

      // Järjestetään junat lähtöajan mukaan
      filtered.sort((a, b) => {
        const aDep = new Date(a.timeTableRows.find(r => r.stationShortCode === from && r.type === "DEPARTURE").scheduledTime);
        const bDep = new Date(b.timeTableRows.find(r => r.stationShortCode === from && r.type === "DEPARTURE").scheduledTime);
        return aDep - bDep;
      });

      // Käydään läpi sopivat junat ja näytetään tiedot
      filtered.forEach(train => {
        const fromTime = train.timeTableRows.find(r => r.stationShortCode === from && r.type === "DEPARTURE");
        const toTime = train.timeTableRows.find(r => r.stationShortCode === to && r.type === "ARRIVAL");

        const dep = new Date(fromTime.scheduledTime); // Lähtöaika
        const arr = new Date(toTime.scheduledTime);   // Saapumisaika
        const mins = Math.round((arr - dep) / 60000); // Kesto minuuteissa

        // Lasketaan mahdollinen viivästys
        const delay = fromTime.liveEstimateTime ? Math.round((new Date(fromTime.liveEstimateTime) - dep) / 60000) : 0;
        
        // Näytettävä raide (tai ? jos ei tiedossa)
        const platform = fromTime.commercialTrack || "?";

        // Luodaan uusi div tuloksia varten
        const div = document.createElement("div");
        div.innerHTML = `
          <p><strong>${train.trainType} ${train.trainNumber}</strong> – ${stationMap[from]} → ${stationMap[to]}</p>
          <p>Lähtöaika: ${dep.toLocaleTimeString("fi-FI")} ${delay ? `(Viivästys: ${delay} min)` : ""}</p>
          <p>Saapumisaika: ${arr.toLocaleTimeString("fi-FI")}</p>
          <p>Kesto: ${mins} minuuttia</p>
          <p>Raide: ${platform}</p>
        `;
        results.appendChild(div); // Lisätään div sivulle
      });
    })
    .catch(err => {
      console.error(err); // Tulostetaan virhe konsoliin
      results.innerHTML = "<p>Virhe haettaessa tietoja.</p>"; // Näytetään virheilmoitus
    });
}

// Lisää tapahtumankäsittelijä hakupainikkeelle
const btn = document.getElementById("searchBtn");
btn.addEventListener("click", () => {
  const from = document.getElementById("fromStation").value;
  const to = document.getElementById("toStation").value;

  // Tarkistetaan että eri asemat on valittu
  if (from && to && from !== to) {
    // Tallennetaan reitti localStorageen myöhempää käyttöä varten
    localStorage.setItem("lastRoute", JSON.stringify({ from, to }));
    fetchTrains(from, to); // Haetaan aikataulut
  } else {
    document.getElementById("results").innerHTML = "<p>Valitse eri lähtö- ja määränpääasema.</p>";
  }
});

// Ladataan viimeksi käytetty reitti localStoragesta sivun latauksen yhteydessä
window.addEventListener("load", () => {
  const saved = JSON.parse(localStorage.getItem("lastRoute"));
  if (saved && saved.from && saved.to) {
    // Odotetaan hetki, että dropdownit ehtivät latautua
    setTimeout(() => {
      document.getElementById("fromStation").value = saved.from;
      document.getElementById("toStation").value = saved.to;
      fetchTrains(saved.from, saved.to); // Haetaan automaattisesti tulokset
    }, 500);
  }
});