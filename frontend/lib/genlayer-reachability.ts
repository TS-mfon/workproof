// GenLayer validator-equivalent reachability snapshot.
// Source: gym.genlayer.foundation/benchmarks/sources-bench, dated 2026-05-18.
// Hosts NOT on either list fall through to a "soft-warn" path in the UI.

export const ACCESSIBLE_HOSTS: ReadonlyArray<string> = [
  "anera.markets", "anfp.cl", "apps.apple.com", "bo3.gg", "conmebollibertadores.com",
  "data.giss.nasa.gov", "dimayor.com.co", "dotabuff.com", "earthquake.usgs.gov", "en.khl.ru",
  "eredivisie.nl", "esportsworldcup.com", "fred.stlouisfed.org", "gol.gg", "hnl.hr",
  "kick.com", "lfpb.com.bo", "lichess.org", "liga1.pe", "ligamx.net",
  "liquipedia.net", "live.bilibili.com", "lmarena.ai", "nikeliga.sk", "play.sooplive.com",
  "portwatch.imf.org", "premierlacrosseleague.com", "premierliga.ru", "pro.eslgaming.com",
  "senedd.wales", "spfl.co.uk", "superligaen.dk", "tff.org", "theahl.com", "truthsocial.com",
  "upl.ua", "vlr.gg", "weather.gov", "weather.gov.hk", "www.a-league.com.au", "www.acb.com",
  "www.aec.gov.au", "www.afa.com.ar", "www.atptour.com", "www.banxico.org.mx",
  "www.billboard.com", "www.binance.com", "www.bleague.jp", "www.bundesliga.com",
  "www.cbf.com.br", "www.cdc.gov", "www.concacaf.com", "www.conmebol.com",
  "www.crunchyroll.com", "www.csl-china.com", "www.dotabuff.com", "www.efa.com.eg",
  "www.efl.com", "www.electoralcommission.org.uk", "www.eliteserien.no",
  "www.euroleaguebasketball.net", "www.fifa.com", "www.flashscore.com",
  "www.flashscoreusa.com", "www.formula1.com", "www.fortunaliga.cz",
  "www.gettyimages.com.mx", "www.huya.com", "www.indiansuperleague.com",
  "www.jleague.jp", "www.juntaelectoralcentral.es", "www.kbl.or.kr", "www.kick.com",
  "www.kleague.com", "www.koreabaseball.com", "www.laliga.com", "www.legaseriea.it",
  "www.legaserieb.it", "www.ligagt.org", "www.ligaportugal.pt", "www.ligue1.com",
  "www.ligue2.fr", "www.lpf.ro", "www.mlb.com", "www.mlssoccer.com", "www.natesilver.net",
  "www.nba.com", "www.ncei.noaa.gov", "www.nec.go.kr", "www.nhl.com",
  "www.nwslsoccer.com", "www.ons.gov.uk", "www.parliament.uk", "www.pgatour.com",
  "www.pglesports.com", "www.premierleague.com", "www.rba.gov.au", "www.rolandgarros.com",
  "www.sec.gov", "www.slstat.com", "www.strategy.com", "www.swpc.noaa.gov",
  "www.the-numbers.com", "www.thefa.com", "www.thenationalleague.org.uk", "www.tsa.gov",
  "www.twitch.tv", "www.uefa.com", "www.ufc.com", "www.unafut.com", "www.vlr.gg",
  "www.weather.gov", "www.weather.gov.hk", "www.wnba.com", "www.wtatennis.com",
  "www.wunderground.com", "www.youtube.com", "xtracker.polymarket.com"
];

export const BLOCKED_WITH_ALT: ReadonlyArray<{ host: string; alt: string }> = [
  { host: "bfunion.bg", alt: "www.espn.com" },
  { host: "democrats.org", alt: "www.apnews.com" },
  { host: "eurovision.com", alt: "en.wikipedia.org" },
  { host: "eurovision.tv", alt: "en.wikipedia.org" },
  { host: "lolesports.com", alt: "liquipedia.net" },
  { host: "ppatour.com", alt: "ppatour.com" },
  { host: "rnc.org", alt: "www.apnews.com" },
  { host: "rollcall.com", alt: "www.apnews.com" },
  { host: "spectrumlocalnews.com", alt: "www.apnews.com" },
  { host: "super.rugby", alt: "www.espn.com" },
  { host: "superliga.rs", alt: "www.espn.com" },
  { host: "www.aba-liga.com", alt: "www.flashscore.com" },
  { host: "www.allsvenskan.se", alt: "www.espn.com" },
  { host: "www.blackrock.com", alt: "www.google.com/finance" },
  { host: "www.bundesliga.at", alt: "www.espn.com" },
  { host: "www.championsleague.basketball", alt: "www.flashscore.com" },
  { host: "www.easycredit-bbl.de", alt: "www.flashscore.com" },
  { host: "www.epcrugby.com", alt: "www.espn.com" },
  { host: "www.esake.gr", alt: "www.flashscore.com" },
  { host: "www.espncricinfo.com", alt: "www.espn.com" },
  { host: "www.fai.ie", alt: "www.espn.com" },
  { host: "www.football.org.il", alt: "www.espn.com" },
  { host: "www.frmf.ma", alt: "www.flashscore.com" },
  { host: "www.iihf.com", alt: "www.flashscore.com" },
  { host: "www.kwqc.com", alt: "www.apnews.com" },
  { host: "www.laliganacional.com.ar", alt: "www.flashscore.com" },
  { host: "www.lnb.fr", alt: "www.flashscore.com" },
  { host: "www.lnr.fr", alt: "www.espn.com" },
  { host: "www.mlsz.hu", alt: "www.espn.com" },
  { host: "www.mostvaluablepromotions.com", alt: "boxrec.com" },
  { host: "www.premiershiprugby.com", alt: "www.espn.com" },
  { host: "www.prvaliga.si", alt: "www.espn.com" },
  { host: "www.reuters.com", alt: "www.apnews.com" },
  { host: "www.rnc.org", alt: "www.apnews.com" },
  { host: "www.unitedrugby.com", alt: "www.espn.com" },
  { host: "www.vtb-league.com", alt: "www.flashscore.com" },
  { host: "www.worldtabletennis.com", alt: "www.flashscore.com" }
];

export const BLOCKED_HOSTS: ReadonlyArray<string> = [
  "allin.com", "farside.co.uk", "finance.yahoo.com", "hltv.org",
  "nytimes.pressreader.com", "play-origin.sooplive.com", "seekingalpha.com",
  "sg.finance.yahoo.com", "thewll.com", "www.aljazeera.com", "www.bls.gov",
  "www.cnn.com", "www.hltv.org", "www.indec.gob.ar", "www.powerslap.com",
  "www.sooplive.com", "www.tbl.org.tr", "www.wsj.com", "x.com",
  // Heuristically blocked: login-walled or known to fail validator fetches.
  "twitter.com", "instagram.com", "facebook.com", "linkedin.com", "tiktok.com",
  "reddit.com", "discord.com", "discord.gg", "drive.google.com", "docs.google.com",
  "calendly.com", "zoom.us", "notion.so", "notion.com", "app.notion.com"
];

function stripWww(host: string) {
  return host.replace(/^www\./, "");
}

export type HostVerdict =
  | { status: "accessible"; host: string }
  | { status: "blocked"; host: string; alt?: string }
  | { status: "unknown"; host: string };

export function classifyHost(rawUrl: string): HostVerdict | null {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    const accessibleSet = new Set(ACCESSIBLE_HOSTS.map((h) => h.toLowerCase()));
    if (accessibleSet.has(host)) return { status: "accessible", host };

    for (const entry of BLOCKED_WITH_ALT) {
      if (host === entry.host.toLowerCase()) return { status: "blocked", host, alt: entry.alt };
    }
    for (const blocked of BLOCKED_HOSTS) {
      const lower = blocked.toLowerCase();
      if (host === lower || host.endsWith("." + stripWww(lower))) return { status: "blocked", host };
    }
    return { status: "unknown", host };
  } catch {
    return null;
  }
}
