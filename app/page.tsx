import { getUpcomingFixtures } from "@/lib/api-client";
import { TOP_LEAGUES, UPCOMING_DAYS } from "@/lib/config";
import FixtureCard from "@/components/FixtureCard";
import { format, isSameDay, addDays, parseISO } from "date-fns";
import { es } from 'date-fns/locale';

interface PageProps {
  searchParams: { leagues?: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home({ searchParams }: { searchParams: Promise<{ leagues?: string }> }) {
  const resolvedSearchParams = await searchParams;
  // Parse league IDs from URL or use defaults
  const leagueIds = resolvedSearchParams.leagues
    ? resolvedSearchParams.leagues.split(',').map(Number)
    : TOP_LEAGUES.map(l => l.id);

  let fixtures = [];

  try {
    fixtures = await getUpcomingFixtures(leagueIds);
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    // fixtures será array vacío
  }

  // Group by date
  const fixturesByDate: Record<string, any[]> = {};

  if (Array.isArray(fixtures)) {
    fixtures.forEach(fixture => {
      const dateKey = fixture.fixture.date.split('T')[0];
      if (!fixturesByDate[dateKey]) {
        fixturesByDate[dateKey] = [];
      }
      // Add metadata manually if missing from API (our client handles it usually but ensure flags)
      const leagueConfig = TOP_LEAGUES.find(l => l.id === fixture.league.id);
      fixture._flag = leagueConfig?.flag;

      fixturesByDate[dateKey].push(fixture);
    });
  }

  const sortedDates = Object.keys(fixturesByDate).sort();
  const totalMatches = Array.isArray(fixtures) ? fixtures.length : 0;

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden glass-panel border border-slate-700/50 p-8 md:p-12">
        <div className="absolute top-0 right-0 p-40 bg-purple-600/20 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 p-32 bg-blue-600/20 rounded-full blur-[80px] -ml-10 -mb-10 pointer-events-none"></div>

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            AI MODEL UPDATED
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Inteligencia</span> que gana partidos.
          </h1>

          <p className="text-slate-300 text-lg mb-8 leading-relaxed">
            Analizamos miles de datos históricos, forma reciente y estadísticas avanzadas para darte la ventaja matemática.
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col">
              <span className="text-3xl font-black text-white">84%</span>
              <span className="text-xs text-slate-400 font-bold uppercase">Precisión Ayer</span>
            </div>
            <div className="w-px h-12 bg-slate-700 mx-2"></div>
            <div className="flex flex-col">
              <span className="text-3xl font-black text-white">{totalMatches}</span>
              <span className="text-xs text-slate-400 font-bold uppercase">Partidos Hoy</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          📅 Próximos Encuentros
        </h2>
        <p className="text-slate-400">Análisis detallados para los siguientes {UPCOMING_DAYS} días.</p>
      </div>

      {sortedDates.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
          <p className="text-slate-500">No upcoming matches found for the selected leagues.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDates.map(dateStr => {
            const dateObj = parseISO(dateStr);
            const isToday = isSameDay(dateObj, new Date());
            const isTomorrow = isSameDay(dateObj, addDays(new Date(), 1));

            let dateLabel = format(dateObj, "EEEE, d 'de' MMMM", { locale: es });
            // Capitalize first letter
            dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

            if (isToday) dateLabel = `🔴 HOY - ${dateLabel}`;
            else if (isTomorrow) dateLabel = `🟡 MAÑANA - ${dateLabel}`;
            else {
              const daysAway = Math.ceil((dateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              // Rough approx or use diffInDays
              dateLabel = `📅 ${dateLabel}`;
            }

            return (
              <section key={dateStr} className="space-y-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-bold text-slate-200 sticky top-20 z-40 bg-slate-950/80 backdrop-blur py-2 px-4 rounded-lg inline-block border border-slate-800/50">
                    {dateLabel}
                  </h3>
                  <div className="h-px bg-slate-800 flex-1"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {fixturesByDate[dateStr].map((fixture, idx) => (
                    <FixtureCard key={fixture.fixture.id} fixture={fixture} index={idx} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  );
}
