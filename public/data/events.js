/* ------------------------------------------------------------------
   IVE — starter events

   On the live site, events are edited at /admin and served by
   /api/events; this file is only used
     - before the first save in the editor (the editor starts from it), and
     - when the pages are opened locally as files, for previewing.

   Fields (only date, title and city are required):
     date         "YYYY-MM-DD"
     time         "HH:MM"           start time, Dutch time
     doors        "HH:MM"
     durationMin  number            used for "Add to calendar"
     title        text; wrap a word in *asterisks* to set it in italics
     …_en         optional English version of a text field, e.g. title_en,
                  description_en, status_en; link.label_en for the button
     description  text
     programme    [{ composer, work, duration }]
     venue, city, price, access, status   text
     link         { label, url }    tickets / reservation button
     image        file name from /images, e.g. "piano-open.jpg"
------------------------------------------------------------------ */

window.IVE_EVENTS = [
    {
        date: "2026-11-14", time: "20:15", doors: "19:45", durationMin: 90,
        title: "*Spiegels* — een solorecital",
        title_en: "*Mirrors* — a solo recital",
        description: "Drie componisten die naar zichzelf kijken: Bachs donkerste partita, Schuberts meest intieme impromptus en Ravels vijf spiegelingen die de avond zijn naam geven.",
        description_en: "Three composers looking at themselves: Bach's darkest partita, Schubert's most private impromptus, and Ravel's five reflections that give the evening its name.",
        programme: [
            { composer: "J. S. Bach", work: "Partita nr. 2 in c, BWV 826", duration: "20′" },
            { composer: "F. Schubert", work: "Vier impromptus, D. 899", duration: "28′" },
            { composer: "M. Ravel", work: "*Miroirs*", duration: "30′" }
        ],
        venue: "Zaal Oost", city: "Maastricht",
        price: "€ 18 / € 12 studenten", price_en: "€ 18 / € 12 students",
        access: "Rolstoeltoegankelijk", access_en: "Step-free, seated",
        status: "Kaarten te koop", status_en: "Tickets on sale",
        link: { label: "Kaarten", label_en: "Tickets", url: "#" },
        image: "piano-open.jpg"
    },
    {
        date: "2026-12-06", time: "16:00", durationMin: 75,
        title: "Zondagsalon: Schubert vierhandig",
        title_en: "Sunday salon: Schubert for four hands",
        description: "Met pianiste Mara Velden. De Fantasie in f, *Lebensstürme* en een paar Ländler, in de salon van een grachtenpand voor zestig mensen. Koffie vanaf 15:30.",
        description_en: "With pianist Mara Velden. The F minor Fantasie, *Lebensstürme* and a few of the Ländler, in a canal-house drawing room for sixty people. Coffee from 15:30.",
        venue: "Huize Wildenhof", city: "Utrecht",
        price: "Gratis", price_en: "Free",
        status: "Gratis — reserveren verplicht", status_en: "Free — reservation required",
        link: { label: "Reserveren", label_en: "Reserve", url: "contact.html?topic=booking" },
        image: "reflection.jpg"
    },
    {
        date: "2027-01-23", time: "22:00", durationMin: 120,
        title: "Late set — piano na middernacht",
        title_en: "Late set — piano after dark",
        description: "Satie, Debussy en wat Bill Evans, tussen de gesprekken en de espressomachine door. Twee sets, geen programma, verzoekjes welkom na middernacht.",
        description_en: "Satie, Debussy and some Bill Evans, played between conversations and the espresso machine. Two sets, no programme, requests welcome after midnight.",
        venue: "Café Kade", city: "Rotterdam",
        price: "Gratis", price_en: "Free",
        status: "Gratis entree — loop binnen", status_en: "Free entry — walk in",
        image: "playing.jpg"
    },

    /* past */
    { date: "2026-09-20", title: "Open Monumentendag — Bach & Ravel", title_en: "Heritage Day — Bach & Ravel", city: "Maastricht" },
    { date: "2026-06-13", title: "Examenrecital, gastsolist", title_en: "Graduation recital, guest soloist", city: "Maastricht" },
    { date: "2026-05-02", title: "Festival Piano aan Zee, avond voor jong talent", title_en: "Festival Piano aan Zee, young artists' night", city: "Zandvoort" },
    { date: "2026-03-08", title: "Schubertiade — salonconcert", title_en: "Schubertiade — salon concert", city: "Utrecht" },
    { date: "2026-01-17", title: "Kamermuziekavond met het Ostinato Kwartet", title_en: "Chamber evening with the Ostinato Quartet", city: "Leiden" },
    { date: "2025-11-22", title: "Recital, Kulturhaus Lindenhof", city: "Hamburg" }
];
