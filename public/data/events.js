/* ------------------------------------------------------------------
   IVE — starter events

   On the live site, events are edited at /admin and served by
   /api/events; this file is only used
     - before the first save in the editor (the editor starts from it), and
     - when the pages are opened locally as files, for previewing.

   Fields (only date, title and city are required):
     date         "YYYY-MM-DD"
     time         "HH:MM"           start time, Amsterdam time
     doors        "HH:MM"
     durationMin  number            used for "Add to calendar"
     title        text; wrap a word in *asterisks* to set it in italics
     description  text
     programme    [{ composer, work, duration }]
     venue, city, price, access, status   text
     link         { label, url }    tickets / reservation button
     image        file name from /images, e.g. "piano-open.jpg"
------------------------------------------------------------------ */

window.IVE_EVENTS = [
    {
        date: "2026-11-14", time: "20:15", doors: "19:45", durationMin: 90,
        title: "*Mirrors* — a solo recital",
        description: "Three composers looking at themselves: Bach's darkest partita, Schubert's most private impromptus, and Ravel's five reflections that give the evening its name.",
        programme: [
            { composer: "J. S. Bach", work: "Partita No. 2 in C minor, BWV 826", duration: "20′" },
            { composer: "F. Schubert", work: "Four Impromptus, D. 899", duration: "28′" },
            { composer: "M. Ravel", work: "*Miroirs*", duration: "30′" }
        ],
        venue: "Zaal Oost", city: "Amsterdam",
        price: "€ 18 / € 12 students", access: "Step-free, seated",
        status: "Tickets on sale",
        link: { label: "Tickets", url: "#" },
        image: "piano-open.jpg"
    },
    {
        date: "2026-12-06", time: "16:00", durationMin: 75,
        title: "Sunday salon: Schubert for four hands",
        description: "With pianist Mara Velden. The F minor Fantasie, the *Lebensstürme* and a few of the Ländler, in a canal-house drawing room for sixty people. Coffee from 15:30.",
        venue: "Huize Wildenhof", city: "Utrecht",
        price: "Free", status: "Free — reservation required",
        link: { label: "Reserve", url: "contact.html?topic=booking" },
        image: "reflection.jpg"
    },
    {
        date: "2027-01-23", time: "22:00", durationMin: 120,
        title: "Late set — piano after dark",
        description: "Satie, Debussy and some Bill Evans, played between conversations and the espresso machine. Two sets, no programme, requests welcome after midnight.",
        venue: "Café Kade", city: "Rotterdam",
        price: "Free", status: "Free entry — walk in",
        image: "playing.jpg"
    },

    /* past */
    { date: "2026-09-20", title: "Open Monumentendag — Bach & Ravel", city: "Haarlem" },
    { date: "2026-06-13", title: "Graduation recital, guest soloist", city: "Amsterdam" },
    { date: "2026-05-02", title: "Festival Piano aan Zee, young artists' night", city: "Zandvoort" },
    { date: "2026-03-08", title: "Schubertiade — salon concert", city: "Utrecht" },
    { date: "2026-01-17", title: "Chamber evening with the Ostinato Quartet", city: "Leiden" },
    { date: "2025-11-22", title: "Recital, Kulturhaus Lindenhof", city: "Hamburg" }
];
