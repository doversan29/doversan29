'use client';

interface RadarData {
    attack: number;
    defense: number;
    possession: number;
    corners: number;
    cards: number;
    form: number;
}

interface RadarChartProps {
    data: RadarData;
    teamName: string;
    color?: string;
}

export default function RadarChart({ data, teamName, color = '#3b82f6' }: RadarChartProps) {
    const points = [
        { label: 'ATA', value: data.attack },
        { label: 'DEF', value: data.defense },
        { label: 'POS', value: data.possession },
        { label: 'COR', data: data.corners },
        { label: 'DIS', value: data.cards },
        { label: 'FOR', value: data.form }
    ];

    // Simple hexagonal projection
    const size = 200;
    const center = size / 2;
    const radius = size * 0.4;

    const getPoint = (index: number, value: number) => {
        const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
        const dist = (value / 100) * radius;
        return {
            x: center + dist * Math.cos(angle),
            y: center + dist * Math.sin(angle)
        };
    };

    const d = points.map((p, i) => {
        const pt = getPoint(i, (p as any).value || (p as any).data || 0);
        return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
    }).join(' ') + ' Z';

    return (
        <div className="flex flex-col items-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                {/* Background Hexagons */}
                {[0.2, 0.4, 0.6, 0.8, 1].map((r) => (
                    <polygon
                        key={r}
                        points={Array.from({ length: 6 }).map((_, i) => {
                            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                            return `${center + radius * r * Math.cos(angle)},${center + radius * r * Math.sin(angle)}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="1"
                    />
                ))}

                {/* Axis Lines */}
                {Array.from({ length: 6 }).map((_, i) => {
                    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                    return (
                        <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={center + radius * Math.cos(angle)}
                            y2={center + radius * Math.sin(angle)}
                            stroke="#1e293b"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Data Polygon */}
                <path
                    d={d}
                    fill={color}
                    fillOpacity="0.3"
                    stroke={color}
                    strokeWidth="2"
                    className="transition-all duration-500"
                />

                {/* Labels */}
                {points.map((p, i) => {
                    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                    const pt = {
                        x: center + (radius + 15) * Math.cos(angle),
                        y: center + (radius + 15) * Math.sin(angle)
                    };
                    return (
                        <text
                            key={i}
                            x={pt.x}
                            y={pt.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-slate-500 text-[8px] font-bold"
                        >
                            {p.label}
                        </text>
                    );
                })}
            </svg>
            <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{teamName}</span>
        </div>
    );
}
