import { getDisciplines } from '@plato/schema'
import type { Discipline } from '@plato/schema'

const CATEGORY_ORDER = [
  'Engineering',
  'Architecture',
  'Security',
  'Quality',
  'Product',
  'Delivery & Management',
  'Analysis & Design',
  'Data',
  'Agile',
  'AI',
]

export default async function Page() {
  const disciplines = await getDisciplines()

  const grouped = disciplines.reduce<Record<string, Discipline[]>>((acc, d) => {
    const cat = d.discipline_category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(d)
    return acc
  }, {})

  // Categories with disciplines, in defined order first, then any extras
  const ordered = [
    ...CATEGORY_ORDER.filter((c) => grouped[c]?.length),
    ...Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c)),
  ]

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, sans-serif; background: #f9fafb; color: #111; }
        main { max-width: 900px; margin: 0 auto; padding: 48px 24px; }
        h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 40px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px; }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
        .card h2 { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin-bottom: 12px; }
        .card ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .card li { display: flex; flex-direction: column; gap: 2px; }
        .name { font-size: 0.925rem; font-weight: 500; }
        .slug { font-size: 0.75rem; color: #9ca3af; font-family: ui-monospace, monospace; }
      `}</style>
      <main>
        <h1>Disciplines</h1>
        <div className="grid">
          {ordered.map((category) => (
            <div key={category} className="card">
              <h2>{category}</h2>
              <ul>
                {grouped[category].map((d) => (
                  <li key={d.discipline_id}>
                    <span className="name">{d.discipline_name}</span>
                    <span className="slug">{d.discipline_slug}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
