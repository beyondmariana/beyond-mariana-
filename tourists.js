// =====================================================================
//  tourists.js  –  MARIANA TOURS
//  Glubschaugen-Touristen, Toiletten-Wanderung (echtes Hinsetzen),
//  FlixBus-Untertitel (DE/EN), Animal-Crossing-Gebrabbel (Web Audio),
//  Live-Bewertung, Tiefsee-Pillen-Rausch, Champagner-Sprüche.
//  Aufruf: createTourists(THREE, subGroup, cabin, {
//            count, volume, container,
//            lang: () => 'de' | 'en',
//            onRating: ({ avg, delta, type, tourist }) => {}
//          })
//  API: event(type), buyPills() -> 30 (€), serveChampagne() -> 20 (€),
//       isHigh, setUpgrades({golden}), averageRating(), update(dt, state) ...
// =====================================================================

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------------------------------------------------------------------
//  DATEN: Namen, Persönlichkeiten, Texte (DE / EN)
// ---------------------------------------------------------------------
const NAMES = [
  "Gisela","Karl-Heinz","Brunhilde","Horst","Ingrid","Dieter","Waltraud","Jürgen",
  "Heidi","Manfred","Erika","Uwe","Sabine","Torsten","Ursula","Gerd","Petra","Bernd",
  "Hannelore","Rüdiger","Chantal","Kevin","Mandy","Jacqueline","Justin","Sandra",
  "Marcel","Nadine","Dennis","Jessica","Tim","Lisa","Ole","Greta","Finn","Mia","Leon",
  "Emma","Paul","Hanna","Luca","Sophie","Jonas","Lena","Felix","Clara","Mehmet",
  "Fatma","Luigi","Giulia","Olaf","Björn","Ayşe","Tomasz","Anneliese","Kai-Uwe",
  "Pia","Bodo"
];

const STR = {
  de: { row: "Reihe", away: "unterwegs", wc: "auf dem WC", avg: "Ø Bewertung der Fahrt" },
  en: { row: "Row",   away: "on the way", wc: "on the loo", avg: "Avg. tour rating" },
};

const PERS = {
  influencer:   { label: { de: "Influencer",    en: "Influencer" },       icon: "📱", pitch: [1.5, 2.0],  rate: [1.2, 1.5],   pos: 1.2, neg: 0.8, mood: { start: 0.2,  idle: 0.1 } },
  geizhals:     { label: { de: "Geizkragen",    en: "Penny-Pincher" },    icon: "💰", pitch: [0.7, 0.9],  rate: [0.8, 1.0],   pos: 0.5, neg: 1.4, mood: { start: -0.1, idle: -0.1 } },
  panik:        { label: { de: "Panik-Macher",  en: "Panicker" },         icon: "😱", pitch: [1.6, 2.1],  rate: [1.6, 2.0],   pos: 0.6, neg: 1.8, mood: { start: -0.2, idle: -0.2 } },
  besserwisser: { label: { de: "Besserwisser",  en: "Know-It-All" },      icon: "🤓", pitch: [1.0, 1.2],  rate: [1.0, 1.2],   pos: 0.8, neg: 1.0, mood: { start: 0.1,  idle: -0.1 } },
  meckerer:     { label: { de: "Dauer-Nörgler", en: "Chronic Grumbler" }, icon: "😤", pitch: [0.5, 0.7],  rate: [0.8, 1.0],   pos: 0.5, neg: 1.3, mood: { start: -0.1, idle: -0.2 } },
  schlaf:       { label: { de: "Schlafmütze",   en: "Sleepyhead" },       icon: "😴", pitch: [0.55, 0.8], rate: [0.55, 0.75], pos: 0.8, neg: 0.4, mood: { start: 0.1,  idle: 0.1 } },
};

const LINES = {
  de: {
    influencer: {
      start:      ["Leute, ich nehm euch mit in die Tiefsee! Vergesst nicht zu liken!", "Story-Time! Dieses U-Boot ist so aesthetic, ich kann nicht."],
      ice:        ["Hey! Das ruiniert mein Live-Video!", "Mein Handy ist runtergefallen, das war mein ganzer Content!"],
      dark:       ["Das Licht hier ist FURCHTBAR für mein Selfie.", "Kein Ringlicht, keine Likes. Danke, Kapitän."],
      sightWreck: ["Ein Schiffswrack! Lost-Place-Content, das knallt!", "Geisterschiff-Vibes! Ich mach ein Reel!"],
      sightCath:  ["OMG, eine Eis-Kathedrale! Das geht viral!", "Hashtag blessed! Zoom mal drauf, Kapitän!"],
      sightWhale: ["Ein Wal!! Der ist RIESIG! Ich muss ein Selfie machen!", "Das ist mein neues Profilbild, ohne Witz."],
      wcBusy:     ["Besetzt?! Ich muss mich noch schminken!", "Wer sitzt da drin? Ich hab gleich einen Livestream!"],
      idle:       ["Wie ist hier das WLAN-Passwort? Ach ja, Tiefsee.", "Ich glaub, mir folgen jetzt auch Fische."],
      fish:       ["Ein Fisch!! Kamera läuft, Leute, das ist Content!", "Der guckt direkt in meine Kamera! Follower, schaut euch das an!"],
      pills:      ["Bonbons!? Ich filme das! Tag: Tiefsee-Candy!", "Mhm, die schmecken nach Regenbogen... Leute... wow."],
      champagne:  ["Champagner! Das gibt ein Unboxing! ...ist das Wasser?", "Luxus-Content! Prost, Follower! Schmeckt... nach Hahn."],
    },
    geizhals: {
      start:      ["Für den Preis hätte ich einen Fensterplatz erwartet.", "Gibt's hier Gratis-Snacks? Nein? Typisch."],
      ice:        ["Das zahl ich nicht, wenn die Lackierung zerkratzt ist!", "Ich will 5 Euro zurück. Mindestens."],
      dark:       ["Wir haben doch für Beleuchtung bezahlt, oder?", "Sparen die hier am Strom? Das erkenne ich sofort."],
      sightWreck: ["Ein Wrack? Gibt's da Schätze? Ich teile nicht!", "Der Kahn war bestimmt versichert. Wo ist meine Provision?"],
      sightCath:  ["Ein Kristall-Palast? Was ist der wert? Kann man den verkaufen?", "Davon nehm ich ein Stück als Entschädigung mit."],
      sightWhale: ["Ein Wal ist hoffentlich im Preis inklusive?", "Wenigstens ein RIESEN-Wal für das viele Geld."],
      wcBusy:     ["Besetzt?! Für die Toilette zahl ich nicht extra!", "Ich hab bezahlt, ich will rein!"],
      idle:       ["Ich hab mein eigenes Butterbrot dabei. Spart Geld.", "Muss man hier Trinkgeld geben? Hoffentlich nicht."],
      fish:       ["Ein großer Fisch! Hoffentlich ist der im Preis inklusive.", "Wenigstens gibt's was zu sehen für das Geld!"],
      pills:      ["29,99 € für Bonbons?! ...egal, schmeckt nach Rabatt.", "Das war's wert. Glaub ich. Hicks."],
      champagne:  ["19,99 € für Wasser? ...Das Etikett ist aber hübsch.", "Das ist Leitungswasser! Ich erkenne Kalk, wenn ich ihn schmecke!"],
    },
    panik: {
      start:      ["Wir tauchen wirklich?! Hat jemand die Schwimmwesten gezählt?!", "Ich hab doch Wasserangst! Wieso bin ich hier?!"],
      ice:        ["WIR SINKEN!! DAS WAR DAS ENDE!!", "Wir haben ein Leck!! Ich seh schon Wasser!!"],
      dark:       ["ES WIRD DUNKEL!! DAS IST DER TOD!!", "Wer hat das Licht ausgemacht?! Mama!!"],
      sightWreck: ["EIN GEISTERSCHIFF!! Da sind bestimmt Skelette drin!!", "Das Wrack hat uns gesehen!! Weiterfahren!!"],
      sightCath:  ["Was leuchtet da?! Ist das radioaktiv?!", "Das ist bestimmt verflucht! Nicht anfassen!"],
      sightWhale: ["EIN MONSTER!! Wir werden gefressen!!", "Der Wal ist RIESIG!! Fahren Sie weg!!"],
      wcBusy:     ["Besetzt?! Ich muss SOFORT, das ist ein Notfall!!", "Aufmachen!! Ich halt das nicht aus!!"],
      idle:       ["Hört ihr das Knarzen? Das ist das Ende!", "Ist das U-Boot TÜV-geprüft?!"],
      fish:       ["AAH! Da schwimmt was Riesiges!! ...oh, wie schön!", "Es sieht uns an!! Ist es freundlich?! Es ist so hübsch!"],
      pills:      ["Sind das Pillen?! Ich... oh... hihi... alles ist so weich...", "Ich hab keine Angst mehr! Ich hab... Sterne!"],
      champagne:  ["Ist das Gift?! Warum perlt das nicht?!", "Es knallt! WIR WERDEN BESCHOSSEN!! ...ach, nur Wasser."],
    },
    besserwisser: {
      start:      ["Eigentlich ist ein U-Boot technisch gesehen ein Tauchboot.", "Ich hab dazu mal eine Doku gesehen. Ich erkläre es euch."],
      ice:        ["Das war Eis. Gefrorenes Wasser. Ich hätte gebremst.", "Laut Physik hätte man das vorher sehen können."],
      dark:       ["Ab 200 Metern dringt kein Sonnenlicht mehr durch. Weiß doch jeder.", "Das ist die aphotische Zone. Nur für Laien dunkel."],
      sightWreck: ["Ein Frachter, Baujahr 1930er. Sieht man am Schornstein.", "Wracks sind künstliche Riffe. Fun Fact."],
      sightCath:  ["Das ist ein Kristallgitter. Hab ich sofort erkannt.", "Eigentlich heißt das Kathedrale nur im übertragenen Sinn."],
      sightWhale: ["Das ist ein Polarwal. Ein Säugetier, falls ihr das nicht wusstet.", "Wale sind keine Fische. Nur zur Info."],
      wcBusy:     ["Die Besetzt-Anzeige ist falsch montiert. Ich hätte das anders gebaut.", "Durchschnittlich dauert ein Toilettengang 90 Sekunden. Das hier ist mehr."],
      idle:       ["Ich hätte das Boot anders gesteuert, nur mal so.", "Fun Fact: Das Wasser draußen ist nass."],
      fish:       ["Ich hab's sofort erkannt: ein Meerestier! Beeindruckend, zugegeben.", "Fun Fact: So etwas sieht man selten aus nächster Nähe. Wie ich schon sagte."],
      pills:      ["Wissenschaftlich gesehen ist das... ein Bonbon. Hihi.", "Ich habe die Wirkung vorausgesagt. Du bist so schön, Kapitän."],
      champagne:  ["Kein Champagner, keine Kohlensäure. Schlicht H2O, Härtegrad 14.", "Champagner darf nur aus der Champagne kommen. Das hier kommt aus dem Hahn."],
    },
    meckerer: {
      start:      ["Das Polster ist hart. Die Luft ist stickig. Super Start.", "Frühe Abfahrt, späte Ankunft, typisch."],
      ice:        ["Muss das so rumpeln?! Mein Kaffee!", "Fahren können die hier auch nicht."],
      dark:       ["Früher war mehr Licht.", "Dunkel, kalt, laut. Eine Zumutung."],
      sightWreck: ["Ein kaputtes Schiff. Na, da passen wir ja gut hin.", "Rostig. Alles ist rostig heutzutage."],
      sightCath:  ["Und dafür die ganze Fahrt? Ein Haufen Eis.", "Ist ja nett, aber der Sitz bleibt unbequem."],
      sightWhale: ["Der Wal sieht müde aus. Genau wie ich.", "Der soll mal Platz machen, ich seh nichts."],
      wcBusy:     ["Immer ist die Toilette besetzt! IMMER!", "Das ist ja schlimmer als auf der Autobahn."],
      idle:       ["Wieso gibt's keine Klimaanlage?", "Ich schreib eine Beschwerde. Mit Durchschlag."],
      fish:       ["Na gut, der Fisch ist ganz nett. Der Sitz ist trotzdem hart.", "Ein Fisch. Ach. Immerhin mal was anderes als dieses Dunkel."],
      pills:      ["Die Dinger sind zu süß. ...Eigentlich ganz okay. Hmm.", "Gut. Jetzt beschwer ich mich... nicht mehr. Wow."],
      champagne:  ["Zu kalt. Und der Korken war aus Plastik.", "Wasser. In einer Flasche. Für 20 Euro. Typisch."],
    },
    schlaf: {
      start:      ["Weckt mich, wenn wir da sind... gähn...", "Ist das schon die Tiefsee? Ich hab noch gar nicht... zzz."],
      ice:        ["Hm? Hat jemand angeklopft? Nur der Eisberg? Okay... zzz.", "Zu laut... bitte nochmal von vorn... zzz."],
      dark:       ["Perfekt zum Schlafen. Gute Nacht.", "Dunkel... endlich... zzz."],
      sightWreck: ["Ein Schiff... schläft auch hier unten... zzz.", "Schönes Bett... äh, Boot... zzz."],
      sightCath:  ["Hübsch... weck mich für die nächste...", "Eis-Kirche? Ich dachte, das ist mein Traum."],
      sightWhale: ["Wal? Hab ich schon im Traum gesehen. Aber so groß...", "Groß... und gemütlich... zzz."],
      wcBusy:     ["Ich warte hier. Ich kann auch im Stehen schlafen.", "Besetzt? Ich lehn mich kurz an die Tür... zzz."],
      idle:       ["Wie weit ist es noch? Ach egal... zzz.", "Hat jemand ein Kissen?"],
      fish:       ["Oh... ein Fisch... wie schön... bin ich wach? Egal... zzz.", "Der schwimmt, wie ich träume... langsam... zzz."],
      pills:      ["Bunte Dinger... noch bunter... zzz... wow.", "Ich schlafe nicht, ich schwebe... zzz."],
      champagne:  ["Sektchen... gähn... schmeckt nach nichts... gut zum Einschlafen.", "Prost... zzz... das ist aber Wasser..."],
    },
  },
  en: {
    influencer: {
      start:      ["Guys, I'm taking you to the deep sea! Don't forget to like and subscribe!", "Story time! This submarine is so aesthetic, I can't even."],
      ice:        ["Hey! You're ruining my live video!", "My phone just fell, that was all my content!"],
      dark:       ["The lighting here is TERRIBLE for my selfie.", "No ring light, no likes. Thanks, Captain."],
      sightWreck: ["A shipwreck! Lost-place content, this slaps!", "Ghost ship vibes! I'm making a reel!"],
      sightCath:  ["OMG, an ice cathedral! This is going viral!", "Hashtag blessed! Zoom in, Captain!"],
      sightWhale: ["A whale!! It's HUGE! I need a selfie!", "That's my new profile pic, no joke."],
      wcBusy:     ["Occupied?! I still have to do my makeup!", "Who's in there? I've got a livestream soon!"],
      idle:       ["What's the Wi-Fi password here? Oh right, deep sea.", "I think fish are following me now."],
      fish:       ["A fish!! Camera's rolling, guys, this is content!", "It's looking right into my camera! Followers, look at this!"],
      pills:      ["Candy!? I'm filming this! Tag: deep-sea candy!", "Mmm, these taste like rainbows... guys... wow."],
      champagne:  ["Champagne! This is an unboxing! ...is that water?", "Luxury content! Cheers, followers! Tastes... like tap."],
    },
    geizhals: {
      start:      ["For this price I expected a window seat.", "Any free snacks here? No? Typical."],
      ice:        ["I'm not paying if the paint is scratched!", "I want 5 euros back. At least."],
      dark:       ["We paid for lighting, didn't we?", "Are they saving on electricity? I can tell right away."],
      sightWreck: ["A wreck? Any treasure? I'm not sharing!", "That boat was surely insured. Where's my cut?"],
      sightCath:  ["A crystal palace? What's it worth? Can you sell it?", "I'll take a piece as compensation."],
      sightWhale: ["Hopefully the whale is included in the price?", "At least a GIANT whale for all that money."],
      wcBusy:     ["Occupied?! I'm not paying extra for the toilet!", "I paid, I want in!"],
      idle:       ["I brought my own sandwich. Saves money.", "Do you have to tip here? Hopefully not."],
      fish:       ["A big fish! Hopefully that's included in the price.", "At least there's something to see for the money!"],
      pills:      ["€29.99 for candy?! ...whatever, tastes like a discount.", "Worth it. I think. Hic."],
      champagne:  ["€19.99 for water? ...the label is pretty, though.", "That's tap water! I know limescale when I taste it!"],
    },
    panik: {
      start:      ["We're really diving?! Did anyone count the life jackets?!", "I'm afraid of water! Why am I here?!"],
      ice:        ["WE'RE SINKING!! THIS IS THE END!!", "We have a leak!! I can already see water!!"],
      dark:       ["IT'S GETTING DARK!! THIS IS DEATH!!", "Who turned off the light?! Mama!!"],
      sightWreck: ["A GHOST SHIP!! There are skeletons in there!!", "The wreck saw us!! Keep driving!!"],
      sightCath:  ["What's glowing there?! Is it radioactive?!", "That's surely cursed! Don't touch it!"],
      sightWhale: ["A MONSTER!! We'll be eaten!!", "The whale is HUGE!! Drive away!!"],
      wcBusy:     ["Occupied?! I need to go RIGHT NOW, it's an emergency!!", "Open up!! I can't hold it!!"],
      idle:       ["Do you hear that creaking? That's the end!", "Is this submarine safety-inspected?!"],
      fish:       ["AAH! Something huge is swimming there!! ...oh, how beautiful!", "It's looking at us!! Is it friendly?! It's so pretty!"],
      pills:      ["Are those pills?! I... oh... hehe... everything is so soft...", "I'm not scared anymore! I have... stars!"],
      champagne:  ["Is that poison?! Why isn't it fizzing?!", "It popped! WE'RE UNDER ATTACK!! ...oh, just water."],
    },
    besserwisser: {
      start:      ["Technically, a submarine is actually a submersible.", "I saw a documentary about this once. Let me explain."],
      ice:        ["That was ice. Frozen water. I would have braked.", "According to physics, you could have seen that coming."],
      dark:       ["Below 200 meters no sunlight gets through. Everyone knows that.", "This is the aphotic zone. Only dark to laypeople."],
      sightWreck: ["A freighter, 1930s build. You can tell by the funnel.", "Wrecks are artificial reefs. Fun fact."],
      sightCath:  ["That's a crystal lattice. I recognized it immediately.", "Technically it's only a cathedral in a figurative sense."],
      sightWhale: ["That's a polar whale. A mammal, in case you didn't know.", "Whales aren't fish. Just so you know."],
      wcBusy:     ["The occupied sign is mounted wrong. I'd have built it differently.", "On average a bathroom visit takes 90 seconds. This is longer."],
      idle:       ["I would have steered the boat differently, just saying.", "Fun fact: the water outside is wet."],
      fish:       ["I recognized it immediately: a marine animal! Impressive, I admit.", "Fun fact: you rarely see that up close. Like I said before."],
      pills:      ["Scientifically speaking, this is... a candy. Hehe.", "I predicted the effect. You are so beautiful, Captain."],
      champagne:  ["No champagne, no carbonation. Plain H2O, hardness 14.", "Champagne may only come from Champagne. This came from the tap."],
    },
    meckerer: {
      start:      ["The seat is hard. The air is stuffy. Great start.", "Early departure, late arrival, typical."],
      ice:        ["Does it have to rumble like that?! My coffee!", "They can't even drive here."],
      dark:       ["There used to be more light.", "Dark, cold, loud. An outrage."],
      sightWreck: ["A broken ship. We fit right in.", "Rusty. Everything is rusty these days."],
      sightCath:  ["And that's what the whole trip was for? A pile of ice.", "Nice and all, but the seat is still uncomfortable."],
      sightWhale: ["The whale looks tired. Just like me.", "Tell it to move over, I can't see anything."],
      wcBusy:     ["The toilet is always occupied! ALWAYS!", "This is worse than the highway."],
      idle:       ["Why is there no air conditioning?", "I'm writing a complaint. In triplicate."],
      fish:       ["Okay, the fish is quite nice. The seat is still hard.", "A fish. Well. At least something other than this darkness."],
      pills:      ["These things are too sweet. ...Actually quite okay. Hmm.", "Fine. Now I'll complain... less. Wow."],
      champagne:  ["Too cold. And the cork was plastic.", "Water. In a bottle. For 20 euros. Typical."],
    },
    schlaf: {
      start:      ["Wake me when we're there... yawn...", "Is this the deep sea already? I haven't even... zzz."],
      ice:        ["Hm? Did someone knock? Just the iceberg? Okay... zzz.", "Too loud... please start over... zzz."],
      dark:       ["Perfect for sleeping. Good night.", "Dark... finally... zzz."],
      sightWreck: ["A ship... sleeping down here too... zzz.", "Nice bed... I mean boat... zzz."],
      sightCath:  ["Pretty... wake me for the next one...", "Ice church? I thought that was my dream."],
      sightWhale: ["Whale? Already saw one in my dream. But this big...", "Big... and cozy... zzz."],
      wcBusy:     ["I'll wait here. I can sleep standing up too.", "Occupied? I'll lean on the door for a bit... zzz."],
      idle:       ["How much farther? Never mind... zzz.", "Does anyone have a pillow?"],
      fish:       ["Oh... a fish... how lovely... am I awake? Whatever... zzz.", "It swims the way I dream... slowly... zzz."],
      pills:      ["Colorful things... even more colorful... zzz... wow.", "I'm not sleeping, I'm floating... zzz."],
      champagne:  ["Bubbly... yawn... tastes like nothing... good for sleeping.", "Cheers... zzz... that's water though..."],
    },
  },
};

// Gemeinsame Sprüche (Persönlichkeit egal)
const SHARED = {
  de: {
    wcGold: ["Die beheizte Goldbrille! Königlich! Ich will nie wieder aufstehen!", "Goldene Klobrille?! Luxus pur! Plus ein Stern!"],
    sober:  ["Wo... wo bin ich? Warum klebt Zucker an meinen Augen?", "Ups. Hab ich Fünf Sterne gesagt? ...Na gut, vier."],
  },
  en: {
    wcGold: ["The heated golden seat! Royal! I never want to get up!", "A golden toilet seat?! Pure luxury! Plus one star!"],
    sober:  ["Where... where am I? Why is there sugar on my eyes?", "Oops. Did I say five stars? ...okay, four."],
  },
};

// Rausch-Sprüche (nach den Tiefsee-Pillen): lallend, immer 5 Sterne
const LINES_HIGH = {
  de: {
    ice:       ["Huiii, der Eisberg hat mich umarmt! Fünf Sterne! Hicks!", "Wuuusch! Nochmal bitte! Sechs Sterne!"],
    dark:      ["Es wird dunkel... wie... bunt! Fünf Sterne, Kapitään...", "Mmh, Disco! Fünf Sterne und ein Bonbon!"],
    sight:     ["Daaas isch... sooo schön... *schluchz* Fünf Sterne!", "Ich seh... alles doppelt! Doppelt gut! Zehn Sterne!"],
    wc:        ["Besetzt? Haha... Klo... Klooo... Fünf Sterne trotzdem...", "Ich warte... hicks... ich kann auch hier tanzen."],
    idle:      ["Wie die Fische... blubb... fünf Sterne für die Fische...", "Kapitään... du bist... mein Lieblingsmensch... Fünf Sterne!"],
    fish:      ["Der Fisch hat mir zugezwinkert!!! Fünf Sterne für Fisch!", "Fiiiisch... Freeeund... fünf Sterne..."],
    champagne: ["Prööösterchen! Das Wasser... sprudelt... in meinem Kopf! Fünf Sterne!", "Edel... geil... fünf Sterne... hicks."],
  },
  en: {
    ice:       ["Wheee, the iceberg hugged me! Five stars! Hic!", "Whooosh! Again please! Six stars!"],
    dark:      ["It's getting dark... how... colorful! Five stars, Capt'n...", "Mmm, disco! Five stars and a candy!"],
    sight:     ["Thaaat is... sooo pretty... *sob* Five stars!", "I see... everything double! Double good! Ten stars!"],
    wc:        ["Occupied? Haha... loo... looo... five stars anyway...", "I'll wait... hic... I can dance here too."],
    idle:      ["Like the fishies... blub... five stars for the fishies...", "Capt'n... you are... my favorite human... Five stars!"],
    fish:      ["The fish winked at me!!! Five stars for fish!", "Fiiish... frieeend... five stars..."],
    champagne: ["Chiiiers! The water... bubbles... in my head! Five stars!", "Fancy... awesome... five stars... hic."],
  },
};

const HIGH_KEY = {
  ice: "ice", dark: "dark", sightWreck: "sight", sightCath: "sight", sightWhale: "sight",
  wcBusy: "wc", idle: "idle", start: "idle", fish: "fish", champagne: "champagne",
};

const SIGHT = { wreck: "sightWreck", cathedral: "sightCath", whale: "sightWhale" };

// Sterne-Änderung pro Ereignis (wird mit pos/neg der Persönlichkeit skaliert)
const DELTA    = { start: 0, ice: -0.4, dark: -0.3, sightWreck: 0.5, sightCath: 0.6, sightWhale: 0.9, wcBusy: -0.5, idle: 0, fish: 0.15, pills: 0.3, champagne: 0.15, wcGold: 0, sober: 0 };
const COOLDOWN = { start: 0, ice: 5, dark: 20, sightWreck: 0, sightCath: 0, sightWhale: 0, wcBusy: 12, idle: 20, fish: 14, pills: 0, champagne: 0, wcGold: 0, sober: 0 };
const PRIO     = { start: 3, ice: 2, dark: 3, sightWreck: 4, sightCath: 4, sightWhale: 5, wcBusy: 2, idle: 0, fish: 3, pills: 5, champagne: 4, wcGold: 3, sober: 3 };

const SKIN  = [0xffc8a2, 0xf4a261, 0x9bf6ff, 0xcdb4db, 0xb5e48c, 0xffafcc, 0xffd166, 0x8ecae6];
const SHIRT = [0xe63946, 0x2a9d8f, 0xf77f00, 0x7209b7, 0x06d6a0, 0xff006e, 0x3a86ff, 0xfee440];
const PANTS = [0x264653, 0x3d405b, 0x1d3557, 0x6d597a, 0x5f0f40, 0x2b2d42];
const HAIR  = [0x2b1b12, 0x6b3e1f, 0xd9a441, 0xe63946, 0x222222, 0xbfbfbf, 0x7b2cbf];
const HATS  = ["cap", "beanie", "sunhat", "tophat", "tuft", "bun", "bald"];
const ACCS  = ["scarf", "camera", "backpack", "fanny", "tie", "stripes"];

const SEAT_LIFT = 0.12;      // Hüfthöhe über dem Boden auf den Heck-Sitzen
const WC_LIFT = 0.39;        // Hüfthöhe auf der Klobrille (Fallback)
const PLAYER = { player: true };
const HIGH_SECONDS = 20;

// ---------------------------------------------------------------------
//  STIMME: Animal-Crossing-Silbengebrabbel + Spül-Sound (Web Audio)
// ---------------------------------------------------------------------
class Voice {
  constructor() { this.ctx = null; this.master = null; this.volume = 0.5; this.current = null; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = window.__MARIANA_AC || (window.__MARIANA_AC = new AC());
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== "running") { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); }
    return true;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  stop() {
    if (this.current && this.ctx) {
      try { this.current.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02); } catch (e) {}
    }
    this.current = null;
  }

  // pitch ~0.5–2.1, rate ~0.3–2.0, slur = lallend (absackende, wabbelnde Töne)
  speak(text, pitch = 1, rate = 1, slur = false) {
    if (!this.unlock()) return text.length * 0.06 / rate;
    this.stop();
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.connect(this.master);
    this.current = out;

    const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
    const step = 0.07 / rate;
    let t = ctx.currentTime + 0.03;
    let n = 0;

    for (const ch of text.toLowerCase()) {
      if (n > 70) break;
      if (/[.!?…]/.test(ch)) { t += step * 2.5; continue; }
      if (ch === ",") { t += step * 1.5; continue; }
      if (!/[a-zäöüßé]/.test(ch)) { t += step * 0.8; continue; }

      const vowel = "aeiouäöü".includes(ch);
      const semi = SCALE[(ch.charCodeAt(0) * 7 + n * 3) % SCALE.length];
      const wob = slur ? 1 + Math.sin(n * 0.9) * 0.07 : 1;
      const f = 200 * pitch * Math.pow(2, semi / 12) * wob;
      const len = (vowel ? step * 1.3 : step * 0.7) * (slur ? 1.3 : 1);

      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      const g2 = ctx.createGain();
      o1.type = "triangle";
      o2.type = "square";
      g2.gain.value = 0.18;
      o1.frequency.setValueAtTime(f, t);
      o1.frequency.linearRampToValueAtTime(slur ? f * 0.84 : f * (vowel ? 1.04 : 0.96), t + len);
      o2.frequency.setValueAtTime(f * 2, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vowel ? 0.5 : 0.28, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
      o1.start(t); o2.start(t);
      o1.stop(t + len + 0.02); o2.stop(t + len + 0.02);

      t += step * (vowel ? 1.1 : 0.8) * (slur ? 1.15 : 1);
      n++;
    }
    return Math.max(0.6, t - ctx.currentTime);
  }

  click() {
    if (!this.unlock()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.05);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.08);
  }

  flush() {
    if (!this.unlock()) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.02, dur = 2.4;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(2200, t + 0.5);
    bp.frequency.exponentialRampToValueAtTime(350, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.25);
    g.gain.linearRampToValueAtTime(0.35, t + 1.4);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = "sine";
    for (let k = 0; k < 7; k++) o.frequency.setValueAtTime(rnd(90, 210), t + 1.4 + k * 0.12);
    og.gain.setValueAtTime(0.0001, t + 1.4);
    og.gain.linearRampToValueAtTime(0.25, t + 1.55);
    og.gain.linearRampToValueAtTime(0, t + 2.35);
    o.connect(og); og.connect(this.master);
    o.start(t + 1.4); o.stop(t + 2.4);
  }

  dispose() {
    this.stop();
    try { if (this.master) this.master.disconnect(); } catch (e) {}
    this.master = null;
    this.ctx = null; // geteilter AudioContext bleibt offen
  }
}

// ---------------------------------------------------------------------
//  UNTERTITEL-BOX (FlixBus-Simulator)
// ---------------------------------------------------------------------
class SubtitleUI {
  constructor(parent) {
    const css = document.createElement("style");
    css.textContent = `
#tourist-sub{position:fixed;left:50%;bottom:16%;transform:translateX(-50%) translateY(10px);
 width:min(680px,92vw);padding:10px 14px;border-radius:14px;background:rgba(8,18,32,.58);
 backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.22);
 color:#fff;font:600 16px/1.35 system-ui,sans-serif;pointer-events:none;opacity:0;
 transition:opacity .25s,transform .25s;z-index:60;text-shadow:0 1px 2px rgba(0,0,0,.6)}
#tourist-sub.on{opacity:1;transform:translateX(-50%)}
#tourist-sub.off{display:none}
#tourist-sub .ts-head{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:13px;margin-bottom:4px}
#tourist-sub .ts-name{font-weight:800;font-size:15px;color:#ffe08a}
#tourist-sub .ts-meta{opacity:.75;font-weight:500}
#tourist-sub .ts-right{margin-left:auto;display:flex;gap:6px;align-items:baseline}
#tourist-sub .ts-stars{font-size:15px;letter-spacing:1px;
 background:linear-gradient(90deg,#ffcf3a var(--p,70%),rgba(255,255,255,.28) var(--p,70%));
 -webkit-background-clip:text;background-clip:text;color:transparent}
#tourist-sub .ts-num{font-weight:800;color:#ffcf3a;font-size:13px}
#tourist-sub .ts-text{font-size:17px}
#tourist-sub .ts-avg{margin-top:5px;font-size:11px;opacity:.6;font-weight:500}`;
    document.head.appendChild(css);
    this.css = css;

    const el = document.createElement("div");
    el.id = "tourist-sub";
    el.innerHTML = `<div class="ts-head"><span class="ts-name"></span><span class="ts-meta"></span>
      <span class="ts-right"><span class="ts-stars">★★★★★</span><span class="ts-num"></span></span></div>
      <div class="ts-text"></div><div class="ts-avg"></div>`;
    parent.appendChild(el);
    this.el = el;
    this.q = (s) => el.querySelector(s);
    this.timer = null;
  }

  setVisible(v) { this.el.classList.toggle("off", !v); }

  show(t, text, avg, ms, lang) {
    const S = STR[lang] || STR.de;
    this.q(".ts-name").textContent = `${t.pers.icon} ${t.name}`;
    this.q(".ts-meta").textContent =
      `${S.row} ${t.seat.row + 1} · ${t.pers.label[lang] || t.pers.label.de}` +
      (t.atWc ? ` · ${S.wc}` : (t.mode === "trip" ? ` · ${S.away}` : "")) +
      (t.M.hi > 0.3 ? " · 😵‍💫" : "");
    this.q(".ts-stars").style.setProperty("--p", `${(t.rating / 5) * 100}%`);
    this.q(".ts-num").textContent = t.rating.toFixed(1);
    this.q(".ts-text").textContent = text;
    this.q(".ts-avg").textContent = `${S.avg}: ★ ${avg.toFixed(1)}`;
    this.el.classList.add("on");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.remove("on"), ms * 1000);
  }

  dispose() { clearTimeout(this.timer); this.el.remove(); this.css.remove(); }
}

// ---------------------------------------------------------------------
//  BOT-BAU: Kapsel-Figur im Glubschaugen-Pillen-Stil (mit Knien)
//  Ursprung = Füße, Blick nach +Z
// ---------------------------------------------------------------------
function buildBot(THREE, o) {
  const std = (c, r = 0.65) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);

  const skin = std(o.skin, 0.5);
  const shirtM = std(o.shirt, 0.7); shirtM.side = THREE.DoubleSide;
  const pantsM = std(o.pants, 0.8);

  const pill = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.5, 8, 20), skin);
  pill.position.y = 0.75; body.add(pill);
  const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.46, 24, 1, true), shirtM);
  shirt.position.y = 0.74; body.add(shirt);
  const pants = new THREE.Mesh(new THREE.SphereGeometry(0.258, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), pantsM);
  pants.position.y = 0.5; body.add(pants);

  const eyeM = std(0xffffff, 0.25), pupM = std(0x111111, 0.2);
  const eyes = [], pupils = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 12), eyeM);
    eye.position.set(s * 0.105, 1.08, 0.19);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), pupM);
    pup.position.set(o.look * 0.02, 0, 0.078);
    eye.add(pup); body.add(eye);
    eyes.push(eye); pupils.push(pup);
  }

  const by = 1.195, br = Math.sqrt(0.25 * 0.25 - (by - 1.0) * (by - 1.0)) + 0.004;
  const arc = 1.5;
  const brow = new THREE.Mesh(new THREE.TorusGeometry(br, 0.02, 6, 20, arc), std(o.browColor, 0.8));
  brow.rotation.order = "YXZ";
  brow.rotation.set(Math.PI / 2, arc / 2 - Math.PI / 2, 0);
  const browG = new THREE.Group();
  browG.position.y = by; browG.rotation.z = o.browTilt;
  brow.position.y = 0; browG.add(brow); body.add(browG);

  const noseC = new THREE.Color(o.skin).lerp(new THREE.Color(0xff6f6f), 0.35);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), std(noseC, 0.5));
  nose.position.set(0, 0.97, 0.255); nose.scale.set(1, 0.85, 1); body.add(nose);

  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std(0x5a1b1b, 0.6));
  mouth.position.set(0, 0.87, 0.245); mouth.scale.set(1.6, 0.35, 0.4); body.add(mouth);

  // Beine: Hüfte -> Oberschenkel -> Knie -> Unterschenkel + Schuh
  const legs = [], knees = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, 0.28, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.06, 4, 8), pantsM); thigh.position.y = -0.07;
    const knee = new THREE.Group(); knee.position.y = -0.14;
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.06, 4, 8), pantsM); shin.position.y = -0.07;
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), std(0x222222, 0.7));
    shoe.position.set(0, -0.13, 0.04); shoe.scale.set(1, 0.6, 1.5);
    knee.add(shin, shoe);
    hip.add(thigh, knee);
    body.add(hip); legs.push(hip); knees.push(knee);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(s * 0.275, 0.92, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 4, 8), shirtM); arm.position.y = -0.16;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), skin); hand.position.y = -0.3;
    p.add(arm, hand); body.add(p); arms.push(p);
  }

  const hg = new THREE.Group(); hg.position.y = 1.0; body.add(hg);
  const hm = std(o.hatColor, 0.7);
  const hairM = std(o.hair, 0.9);
  const dome = (r, th, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, th), m);
  switch (o.hat) {
    case "cap": {
      const d = dome(0.268, 0.75, hm); d.rotation.x = -0.28; hg.add(d);
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.025, 0.15), hm);
      v.position.set(0, 0.19, 0.27); v.rotation.x = 0.15; hg.add(v); break;
    }
    case "beanie": {
      const d = dome(0.268, 0.95, hm); d.rotation.x = -0.2; hg.add(d);
      const pm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std(0xffffff, 0.9)); pm.position.set(0, 0.3, -0.03); hg.add(pm); break;
    }
    case "sunhat": {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 24), hm); b.position.y = 0.2; hg.add(b);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 20), hm); c.position.y = 0.27; hg.add(c); break;
    }
    case "tophat": {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 20), std(0x151515, 0.6)); c.position.y = 0.38; hg.add(c);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 24), std(0x151515, 0.6)); b.position.y = 0.24; hg.add(b);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 20), std(0xe63946, 0.6)); r.position.y = 0.28; hg.add(r); break;
    }
    case "tuft": {
      for (const [x, y, rz] of [[-0.09, 0.26, 0.5], [0, 0.31, 0], [0.09, 0.26, -0.5]]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 8), hairM);
        c.position.set(x, y, 0); c.rotation.z = rz; hg.add(c);
      } break;
    }
    case "bun": {
      const d = dome(0.262, 0.5, hairM); d.rotation.x = -0.3; hg.add(d);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), hairM); b.position.set(0, 0.3, -0.05); hg.add(b); break;
    }
    default: break;
  }

  for (const a of o.accs) {
    if (a === "scarf") {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.04, 8, 20), std(o.accColor, 0.8));
      m.rotation.x = Math.PI / 2; m.position.y = 0.82; body.add(m);
    } else if (a === "camera") {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.07), std(0x222222, 0.4));
      m.position.set(0.05, 0.68, 0.265); body.add(m);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 10), std(0x88aacc, 0.2));
      l.rotation.x = Math.PI / 2; l.position.set(0.05, 0.68, 0.31); body.add(l);
    } else if (a === "backpack") {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.12), std(o.accColor, 0.8));
      m.position.set(0, 0.75, -0.29); body.add(m);
    } else if (a === "fanny") {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.07), std(o.accColor, 0.8));
      m.position.set(0, 0.54, 0.27); body.add(m);
    } else if (a === "tie") {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), std(o.accColor, 0.6));
      m.rotation.x = Math.PI; m.position.set(0, 0.7, 0.265); body.add(m);
    } else if (a === "stripes") {
      for (const y of [0.6, 0.78]) {
        const m = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.02, 6, 24), std(0xffffff, 0.8));
        m.rotation.x = Math.PI / 2; m.position.y = y; body.add(m);
      }
    }
  }
  return { group: g, body, legs, knees, arms, eyes, pupils, mouth };
}

// ---------------------------------------------------------------------
//  TOURIST (Zustandsmaschine mit Schritt-Liste)
// ---------------------------------------------------------------------
class Tourist {
  constructor(THREE, M, idx, name, persKey, seat) {
    this.M = M; this.idx = idx; this.name = name;
    this.persKey = persKey; this.pers = PERS[persKey]; this.seat = seat;
    this.pitch = rnd(...this.pers.pitch);
    this.rate = rnd(...this.pers.rate);
    this.rating = rnd(3.3, 4.6);

    this.seatFace = seat.face !== undefined ? seat.face : Math.PI;
    this.x = seat.x; this.z = seat.z;
    this.heading = this.seatFace; this.headingT = this.seatFace;
    this.sit = 1; this.sitT = 1;
    this.lift = SEAT_LIFT; this.liftT = SEAT_LIFT;
    this.atWc = false;
    this.mode = "seated"; this.steps = [];
    this.t = rnd(0, 10); this.phase = 0; this.moving = false;
    this.talkUntil = 0; this.stagger = 0; this.blink = rnd(1, 4); this.blinkT = 0;

    const hair = pick(HAIR);
    this.look = rnd(-1, 1);
    this.bot = buildBot(THREE, {
      skin: pick(SKIN), shirt: pick(SHIRT), pants: pick(PANTS),
      hair, hat: pick(HATS), hatColor: pick(SHIRT), browColor: hair,
      browTilt: rnd(-0.13, 0.13), look: this.look,
      accs: shuffle(ACCS.slice()).slice(0, 1 + Math.floor(Math.random() * 2)),
      accColor: pick(SHIRT),
    });
    M.sub.add(this.bot.group);

    // Rausch-Effekte: 3 Sterne + 3 Bläschen kreisen über dem Kopf
    this.fx = [];
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(
        k % 2 ? M.fxGeo.bub : M.fxGeo.star,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
      );
      m.visible = false;
      this.bot.group.add(m);
      this.fx.push({ m });
    }
  }

  addRating(d) {
    const m = d > 0 ? this.pers.pos : this.pers.neg;
    this.rating = clamp(this.rating + d * m, 1, 5);
  }

  startTrip() {
    const M = this.M, c = M.cabin, s = this.seat;
    const outX = c.aisleX + 0.25, backX = c.aisleX - 0.25;
    const queueZ = c.wcFront.z - 0.6;
    const faceWc = c.wcFace !== undefined ? c.wcFace : Math.PI / 2;                   // Blick zur Toilette (+X)
    const ws = c.wcSeat || { x: c.wcInside.x + 0.85, z: c.wcInside.z, lift: WC_LIFT, face: -Math.PI / 2 };
    M.walkers++;
    this.mode = "trip";
    this.steps = [
      { stand: true },
      { go: [outX, s.z] },
      { go: [outX, queueZ] },
      { call: () => { if (M.wc.occ) M.event("wcBusy", { tourist: this }); } },
      { until: () => !M.wc.occ },
      { call: () => { M.wc.occ = this; M.doorTarget = 1; M.voice.click(); } },
      { go: [c.aisleX, c.wcFront.z] },
      { go: [c.wcInside.x, c.wcInside.z] },
      { call: () => { M.doorTarget = 0; M.voice.click(); } },
      { face: faceWc },                                          // Toilette anschauen
      { wait: 0.5 },
      { face: ws.face },                                         // umdrehen (Rücken zur Schüssel)
      { wait: 0.3 },
      { go: [ws.x, ws.z], speed: 0.5, noTurn: true },            // rückwärts an die Brille
      { sit: true, lift: ws.lift },                              // HINSETZEN (Beine gebeugt)
      { call: () => {
          this.atWc = true; M.voice.click();
          if (M.upg.golden) { M.bonus(0.3); M.event("wcGold", { tourist: this }); }   // Goldene Beheizte Klobrille
        } },
      { wait: rnd(4.5, 7) },                                     // sitzen bleiben
      { stand: true },                                           // aufstehen
      { call: () => { this.atWc = false; } },
      { go: [c.wcInside.x, c.wcInside.z] },                      // einen Schritt von der Schüssel weg
      { face: faceWc },
      { wait: 0.4 },
      { call: () => { M.voice.flush(); if (c.flush) c.flush(); } }, // SPÜLEN
      { wait: 2.6 },
      { call: () => { M.doorTarget = 1; M.voice.click(); } },
      { wait: 0.6 },
      { go: [c.aisleX, c.wcFront.z] },
      { go: [backX, c.wcFront.z - 0.4] },
      { call: () => { M.doorTarget = 0; M.wc.occ = null; M.voice.click(); } },
      { go: [backX, s.z] },
      { go: [s.x, s.z] },
      { face: this.seatFace },
      { sit: true, lift: SEAT_LIFT },
      { call: () => { this.mode = "seated"; M.walkers--; } },
    ];
  }

  _run(dt) {
    const s = this.steps[0];
    if (!s) { this.mode = "seated"; return; }
    if (s.go) {
      const dx = s.go[0] - this.x, dz = s.go[1] - this.z, d = Math.hypot(dx, dz);
      const sp = (s.speed || 0.95) * dt;
      if (d <= sp) { this.x = s.go[0]; this.z = s.go[1]; this.steps.shift(); }
      else {
        this.x += (dx / d) * sp; this.z += (dz / d) * sp;
        if (!s.noTurn) this.headingT = Math.atan2(dx, dz);
        this.moving = true;
      }
    } else if (s.wait !== undefined) { s.wait -= dt; if (s.wait <= 0) this.steps.shift(); }
    else if (s.until) { if (s.until()) this.steps.shift(); }
    else if (s.call) { s.call(); this.steps.shift(); }
    else if (s.stand) { this.sitT = 0; if (this.sit < 0.03) this.steps.shift(); }
    else if (s.sit) {
      this.sitT = 1;
      if (s.lift !== undefined) this.liftT = s.lift;
      if (this.sit > 0.97 && Math.abs(this.lift - this.liftT) < 0.01) this.steps.shift();
    }
    else if (s.face !== undefined) {
      this.headingT = s.face;
      if (Math.abs(angDiff(s.face, this.heading)) < 0.06) this.steps.shift();
    }
  }

  update(dt) {
    const M = this.M, b = this.bot;
    this.t += dt;

    // Sitzende Touristen bleiben exakt auf ihrem Platz (kein Herumrutschen / Stehen auf der Theke)
    if (this.mode === "seated") {
      this.x = this.seat.x; this.z = this.seat.z;
      this.headingT = this.seatFace;
      this.sitT = 1; this.liftT = SEAT_LIFT;
    }

    this.sit += clamp(this.sitT - this.sit, -dt * 2.5, dt * 2.5);
    this.lift += clamp(this.liftT - this.lift, -dt * 1.5, dt * 1.5);
    this.moving = false;
    if (this.mode === "trip") this._run(dt);
    this.heading += clamp(angDiff(this.headingT, this.heading), -dt * 6, dt * 6);

    const hi = M.hi;
    const sit = this.sit, spd = this.moving ? 1 : 0;
    this.phase += dt * (this.moving ? 7 : 0);
    const sw = Math.sin(this.phase);
    this.stagger = Math.max(0, this.stagger - dt * 1.2);
    const st = this.stagger;
    const talking = M.time < this.talkUntil;

    b.group.position.set(this.x, M.cabin.floorY + this.lift * sit + Math.abs(sw) * 0.03 * spd, this.z);
    b.group.rotation.y = this.heading;

    b.legs[0].rotation.x = -Math.PI / 2 * sit + sw * 0.7 * (1 - sit) * spd;
    b.legs[1].rotation.x = -Math.PI / 2 * sit - sw * 0.7 * (1 - sit) * spd;
    b.knees[0].rotation.x = 1.45 * sit + Math.max(0, sw) * 0.6 * (1 - sit) * spd;
    b.knees[1].rotation.x = 1.45 * sit + Math.max(0, -sw) * 0.6 * (1 - sit) * spd;
    const gest = talking ? Math.sin(this.t * 9) * 0.45 : 0;
    b.arms[0].rotation.x = -0.55 * sit - sw * 0.6 * (1 - sit) * spd;
    b.arms[1].rotation.x = -0.55 * sit + sw * 0.6 * (1 - sit) * spd + gest;
    b.arms[1].rotation.z = talking ? -0.3 : 0;

    // Wackeln im Gang + Ruckeln bei Kollision + Rausch-Schaukeln auf dem Sitz
    const sway = Math.sin(this.t * 1.7 + this.idx) * 0.13 * hi * (this.mode === "seated" ? 1 : 0.5);
    b.body.rotation.z = sw * 0.12 * spd + Math.sin(this.t * 35) * 0.12 * st + Math.sin(this.t * 0.8 + this.idx) * 0.02 * sit + sway;
    b.body.rotation.x = 0.05 * spd + Math.sin(this.t * 28) * 0.08 * st + Math.sin(this.t * 1.3 + this.idx * 2) * 0.05 * hi;

    // Mund, Blinzeln, Rausch-Augen (halb geschlossen, schielend)
    b.mouth.scale.y = talking ? 0.4 + Math.abs(Math.sin(this.t * 22)) * 1.3 : 0.35 + 0.35 * hi;
    this.blink -= dt;
    if (this.blink < 0) { this.blink = rnd(2, 5); this.blinkT = 0.15; }
    this.blinkT = Math.max(0, this.blinkT - dt);
    const ey = this.blinkT > 0 ? 0.1 : (1 - 0.5 * hi);
    b.eyes[0].scale.y = b.eyes[1].scale.y = ey;
    for (let i = 0; i < 2; i++) {
      const sg = i === 0 ? -1 : 1;
      b.pupils[i].position.x = this.look * 0.02 * (1 - hi) + (-sg * 0.038 + Math.sin(this.t * 1.1 + i) * 0.012) * hi;
    }

    // Bunte Sterne und Bläschen über dem Kopf
    for (let k = 0; k < this.fx.length; k++) {
      const f = this.fx[k].m;
      f.visible = hi > 0.02;
      if (!f.visible) continue;
      const a = this.t * (1.4 + k * 0.15) + k * 1.05;
      const r = 0.3 + 0.04 * Math.sin(this.t * 2 + k);
      f.position.set(Math.cos(a) * r, 1.62 + 0.1 * (k % 3) + 0.05 * Math.sin(this.t * 2.3 + k), Math.sin(a) * r);
      f.scale.setScalar(hi * (0.8 + 0.4 * Math.sin(this.t * 4 + k)));
      f.rotation.y = this.t * 2;
      f.material.color.setHSL((this.t * 0.4 + k / 6) % 1, 0.9, 0.6);
    }
  }
}

// ---------------------------------------------------------------------
//  MANAGER
// ---------------------------------------------------------------------
export function createTourists(THREE, subGroup, cabin, opts = {}) {
  const voice = new Voice();
  voice.volume = opts.volume ?? 0.5;
  const ui = new SubtitleUI(opts.container || document.body);

  const getLang = () => {
    let l = typeof opts.lang === "function" ? opts.lang() : opts.lang;
    if (!l && typeof document !== "undefined") l = document.documentElement.lang;
    return l === "en" ? "en" : "de";
  };

  const M = {
    sub: subGroup, cabin, voice, ui,
    tourists: [], wc: { occ: null }, doorTarget: 0, door: 0, occShown: null,
    walkers: 0, last: {}, current: null, lastSpeaker: null,
    time: 0, nextTrip: rnd(60, 100), idleT: rnd(25, 40), dark: false,
    highUntil: 0, hi: 0, wasHigh: false,
    upg: { golden: false },
    fxGeo: { star: new THREE.OctahedronGeometry(0.05, 0), bub: new THREE.SphereGeometry(0.035, 8, 6) },
  };

  const avg = () => M.tourists.reduce((s, t) => s + t.rating, 0) / Math.max(1, M.tourists.length);

  function notify(type, tourist, delta) {
    if (typeof opts.onRating !== "function") return;
    try { opts.onRating({ avg: avg(), delta, type, tourist }); }
    catch (err) { console.error("[Touristen] onRating:", err); }
  }

  const canSay = (prio) => !(M.current && M.current.until > M.time && prio < M.current.prio);

  function say(t, text, prio) {
    if (!canSay(prio)) return false;
    const high = M.time < M.highUntil;
    // Rausch: tiefer, viel langsamer, lallend
    const dur = voice.speak(text, t.pitch * (high ? 0.78 : 1), t.rate * (high ? 0.55 : 1), high);
    t.talkUntil = M.time + dur;
    M.current = { until: M.time + dur + 0.8, prio };
    ui.show(t, text, avg(), Math.max(3.2, dur + 1.4), getLang());
    return true;
  }

  // Direkter Sterne-Bonus für alle (z. B. Goldene Klobrille), unabhängig von der Persönlichkeit
  M.bonus = (d) => {
    const before = avg();
    M.tourists.forEach((t) => { t.rating = clamp(t.rating + d, 1, 5); });
    notify("wcGold", null, avg() - before);
  };

  function event(type, data = {}) {
    if (!M.tourists.length) return;
    if (type === "sight") type = SIGHT[data.kind] || "sightWhale";
    const cd = COOLDOWN[type] ?? 0;
    if (M.last[type] !== undefined && M.time - M.last[type] < cd) return;

    let sp = data.tourist;
    if (!sp) {
      const pool = M.tourists.filter((t) => t !== M.lastSpeaker);
      sp = pick(pool.length ? pool : M.tourists);
    }
    const prio = PRIO[type] ?? 1;
    const mood = type === "start" || type === "idle";
    const speak = canSay(prio);
    if (mood && !speak) return;
    M.last[type] = M.time;

    const high = M.time < M.highUntil;

    // Bewertung: jedes Ereignis / jeder Spruch bewegt die Sterne.
    // Im Rausch wird ALLES zu einem positiven Ereignis (auch Eisberg-Crashs).
    const before = avg();
    let d = mood ? (sp.pers.mood[type] || 0) : (DELTA[type] || 0);
    if (high && d && type !== "pills") d = Math.max(Math.abs(d), 0.15) + 0.1;
    if (d) M.tourists.forEach((t) => t.addRating(d));
    if (type === "ice") M.tourists.forEach((t) => (t.stagger = 1));

    if (speak) {
      const lang = getLang();
      let text;
      if (high && HIGH_KEY[type]) {
        text = pick((LINES_HIGH[lang] || LINES_HIGH.de)[HIGH_KEY[type]]);
      } else if (type === "wcGold" || type === "sober") {
        text = pick((SHARED[lang] || SHARED.de)[type]);
      } else {
        const set = (LINES[lang] || LINES.de)[sp.persKey];
        text = pick(set[type] || set.idle);
      }
      if (say(sp, text, prio)) M.lastSpeaker = sp;
    }
    if (d) notify(type, sp, avg() - before);
  }
  M.event = event;

  // Sitzplätze: aus cabin.seats; ungültige (Hindernis / außerhalb) werden übersprungen
  const rowZ = cabin.rowZ || [];
  const rawSeats = (cabin.seats && cabin.seats.length)
    ? cabin.seats
    : rowZ.flatMap((z, row) => [-1, 1].map((s) => ({ x: s * cabin.seatX, z, row })));
  const blockers = cabin.blockers || [];
  const minRowZ = rowZ.length ? Math.min(...rowZ) - 0.1 : -Infinity;
  const seatOk = (s) =>
    Math.abs(s.x) <= cabin.seatX + 0.05 &&
    s.z >= minRowZ &&
    !blockers.some((o) => s.x > o.x0 - 0.3 && s.x < o.x1 + 0.3 && s.z > o.z0 - 0.3 && s.z < o.z1 + 0.3);
  const seats = shuffle(
    rawSeats.filter(seatOk).map((s) => ({ x: s.x, z: s.z, row: s.row, face: Math.PI }))
  );

  const names = shuffle(NAMES.slice());
  const keys = shuffle(Object.keys(PERS));
  const count = Math.min(opts.count ?? 4 + Math.floor(Math.random() * 3), seats.length, 6);
  for (let i = 0; i < count; i++) {
    M.tourists.push(new Tourist(THREE, M, i, names[i], keys[i % keys.length], seats[i]));
  }

  notify("init", null, 0);

  return {
    tourists: M.tourists,
    event,
    unlockAudio: () => voice.unlock(),
    setVolume: (v) => voice.setVolume(v),
    setSubtitlesVisible: (v) => ui.setVisible(v),
    averageRating: avg,

    // Bord-Bar: Tiefsee-Pillen (+30 €): 20 s Rausch. Gibt den Geldbetrag zurück.
    buyPills() {
      M.highUntil = M.time + HIGH_SECONDS;
      event("pills");
      return 30;
    },
    // Bord-Bar: Arktis-Champagner (+20 €). Gibt den Geldbetrag zurück.
    serveChampagne() {
      event("champagne");
      return 20;
    },
    get isHigh() { return M.time < M.highUntil; },
    get highLeft() { return Math.max(0, M.highUntil - M.time); },

    // Upgrades: { golden: bool } (Goldene Beheizte Klobrille: +0.3 ★ bei jedem WC-Gang)
    setUpgrades(u) { Object.assign(M.upg, u || {}); },

    // Bord-WC: Spieler setzt sich / steht auf
    wcOccupied: () => !!M.wc.occ,
    setPlayerOnToilet(on) {
      if (on) {
        if (M.wc.occ && M.wc.occ !== PLAYER) return false;
        M.wc.occ = PLAYER;
        return true;
      }
      if (M.wc.occ === PLAYER) M.wc.occ = null;
      return true;
    },
    get playerOnToilet() { return M.wc.occ === PLAYER; },
    playFlush: () => voice.flush(),

    // state: { depth: Meter, showSubtitles: bool }
    update(dt, state = {}) {
      dt = Math.min(dt, 0.1);
      M.time += dt;
      if (state.showSubtitles !== undefined) ui.setVisible(state.showSubtitles);

      // Rausch-Intensität weich ein-/ausblenden
      const high = M.time < M.highUntil;
      M.hi += ((high ? 1 : 0) - M.hi) * clamp(dt * 2, 0, 1);
      if (M.wasHigh && !high) event("sober");
      M.wasHigh = high;

      if (state.depth !== undefined) {
        if (state.depth > 150 && !M.dark) { M.dark = true; event("dark"); }
        else if (state.depth < 110) M.dark = false;
      }

      // WC-Gänge: bewusst selten (alle 75–150 s ein Versuch, nur ~55 % Chance, nie mehrere gleichzeitig)
      M.nextTrip -= dt;
      if (M.nextTrip <= 0) {
        M.nextTrip = rnd(75, 150);
        if (M.walkers < 1 && Math.random() < 0.55) {
          const c = M.tourists.filter((t) => t.mode === "seated" && t.sit > 0.95);
          if (c.length) pick(c).startTrip();
        }
      }
      M.idleT -= dt;
      if (M.idleT <= 0) {
        M.idleT = rnd(30, 55);
        if (!(M.current && M.current.until > M.time)) event("idle");
      }

      const dd = M.doorTarget - M.door;
      if (dd !== 0) { M.door += clamp(dd, -dt * 1.6, dt * 1.6); if (cabin.setDoor) cabin.setDoor(M.door); }
      const occ = !!M.wc.occ;
      if (occ !== M.occShown) { M.occShown = occ; if (cabin.setOccupied) cabin.setOccupied(occ); }

      M.tourists.forEach((t) => t.update(dt));
    },

    dispose() {
      M.tourists.forEach((t) => {
        M.sub.remove(t.bot.group);
        t.bot.group.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      });
      M.tourists.length = 0;
      M.wc.occ = null;
      if (cabin.setOccupied) cabin.setOccupied(false);
      voice.dispose();
      ui.dispose();
    },
  };
}