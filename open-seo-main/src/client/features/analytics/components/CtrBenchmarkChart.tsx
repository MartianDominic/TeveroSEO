/**
 * CTR Benchmark Chart Component
 * Phase 96-05: Client Portal
 *
 * Line chart showing CTR comparison:
 * - Benchmark CTR curve (gray dashed line)
 * - Client's actual CTR by position (solid line)
 * - Above/below indicators (green/red dots)
 *
 * Design System v6: Recharts with consistent styling.
 * WCAG 2.1 AA compliant: role="img", aria-label, hidden data table
 */
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
} from 'recharts';
import { Check, X, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';

interface CtrDataPoint {
  position: number;
  benchmarkCtr: number;
  actualCtr?: number;
  status?: 'above' | 'at' | 'below';
}

interface CtrBenchmarkChartProps {
  data: CtrDataPoint[];
  maxPosition?: number;
  showActual?: boolean;
  title?: string;
}

export function CtrBenchmarkChart({
  data,
  maxPosition = 20,
  showActual = true,
  title = 'CTR vs Position Benchmark',
}: CtrBenchmarkChartProps) {
  // Filter to max position
  const chartData = data.filter((d) => d.position <= maxPosition);

  // Calculate domains
  const maxCtr = Math.max(...chartData.map((d) => Math.max(d.benchmarkCtr, d.actualCtr || 0)));
  const yDomain = [0, Math.ceil(maxCtr * 100) / 100 + 0.05];

  // Calculate accessibility summary
  const accessibilitySummary = useMemo(() => {
    const withActual = chartData.filter((d) => d.actualCtr !== undefined);
    const aboveCount = withActual.filter((d) => d.status === 'above').length;
    const belowCount = withActual.filter((d) => d.status === 'below').length;
    const atCount = withActual.filter((d) => d.status === 'at').length;

    const avgBenchmark = chartData.reduce((sum, d) => sum + d.benchmarkCtr, 0) / chartData.length;
    const avgActual = withActual.length > 0
      ? withActual.reduce((sum, d) => sum + (d.actualCtr || 0), 0) / withActual.length
      : 0;

    return {
      totalPositions: chartData.length,
      aboveCount,
      belowCount,
      atCount,
      avgBenchmark,
      avgActual,
      performance: aboveCount > belowCount ? 'above average' : aboveCount < belowCount ? 'below average' : 'at average',
    };
  }, [chartData]);

  const ariaLabel = `CTR benchmark chart comparing your click-through rate against industry benchmarks for positions 1 to ${maxPosition}. Overall performance: ${accessibilitySummary.performance}. ${accessibilitySummary.aboveCount} positions above benchmark, ${accessibilitySummary.belowCount} below, ${accessibilitySummary.atCount} at benchmark.`;

  return (
    <Card className="bg-surface shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] font-medium text-text-1">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Visually hidden data table for screen readers */}
        <div className="sr-only">
          <table>
            <caption>CTR Benchmark Data: Your CTR compared to industry benchmarks by position</caption>
            <thead>
              <tr>
                <th scope="col">Position</th>
                <th scope="col">Industry Benchmark CTR</th>
                <th scope="col">Your CTR</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((point) => (
                <tr key={point.position}>
                  <td>{point.position}</td>
                  <td>{(point.benchmarkCtr * 100).toFixed(1)}%</td>
                  <td>{point.actualCtr !== undefined ? `${(point.actualCtr * 100).toFixed(1)}%` : 'N/A'}</td>
                  <td>
                    {point.status === 'above' ? 'Above benchmark' : point.status === 'below' ? 'Below benchmark' : 'At benchmark'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="h-[300px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
              <XAxis
                dataKey="position"
                tick={{ fill: 'var(--text-3)', fontSize: 12 }}
                tickLine={{ stroke: 'var(--hairline)' }}
                axisLine={{ stroke: 'var(--hairline)' }}
                label={{
                  value: 'Position',
                  position: 'bottom',
                  offset: 5,
                  style: { fill: 'var(--text-3)', fontSize: 12 },
                }}
              />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                domain={yDomain}
                tick={{ fill: 'var(--text-3)', fontSize: 12 }}
                tickLine={{ stroke: 'var(--hairline)' }}
                axisLine={{ stroke: 'var(--hairline)' }}
                label={{
                  value: 'CTR',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'var(--text-3)', fontSize: 12 },
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as CtrDataPoint;
                    return (
                      <div className="bg-surface border border-hairline rounded-md px-3 py-2 shadow-pop">
                        <p className="text-[13px] font-medium text-text-1">
                          Position {data.position}
                        </p>
                        <p className="text-[12px] text-text-3 mt-1">
                          Benchmark: {(data.benchmarkCtr * 100).toFixed(1)}%
                        </p>
                        {data.actualCtr !== undefined && (
                          <>
                            <p className="text-[12px] text-text-2 mt-0.5">
                              Actual: {(data.actualCtr * 100).toFixed(1)}%
                            </p>
                            <p
                              className={`text-[12px] font-medium mt-1 ${
                                data.status === 'above'
                                  ? 'text-success'
                                  : data.status === 'below'
                                    ? 'text-error'
                                    : 'text-text-3'
                              }`}
                            >
                              {data.status === 'above'
                                ? 'Above benchmark'
                                : data.status === 'below'
                                  ? 'Below benchmark'
                                  : 'At benchmark'}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => (
                  <span className="text-[12px] text-text-2">{value}</span>
                )}
              />

              {/* Benchmark line (dashed) */}
              <Line
                type="monotone"
                dataKey="benchmarkCtr"
                name="Industry Benchmark"
                stroke="var(--text-3)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={false}
              />

              {/* Actual CTR line (solid) */}
              {showActual && (
                <Line
                  type="monotone"
                  dataKey="actualCtr"
                  name="Your CTR"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (!payload.actualCtr) return <></>;

                    const color =
                      payload.status === 'above'
                        ? '#1B6E45'
                        : payload.status === 'below'
                          ? '#9B2C2C'
                          : 'var(--text-3)';

                    return (
                      <circle
                        key={`dot-${payload.position}`}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={color}
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  }}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend explanation with icons for colorblind accessibility */}
        <div className="mt-4 flex items-center gap-6 text-[12px] text-text-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-success flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-white" aria-hidden="true" />
            </div>
            <span>Above benchmark</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-error flex items-center justify-center">
              <X className="w-2.5 h-2.5 text-white" aria-hidden="true" />
            </div>
            <span>Below benchmark</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-text-3 flex items-center justify-center">
              <Minus className="w-2.5 h-2.5 text-white" aria-hidden="true" />
            </div>
            <span>At benchmark</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Mini version for dashboard cards
 * WCAG 2.1 AA compliant with icon indicators
 */
export function CtrBenchmarkMini({
  position,
  benchmarkCtr,
  actualCtr,
  status,
}: {
  position: number;
  benchmarkCtr: number;
  actualCtr: number;
  status: 'above' | 'at' | 'below';
}) {
  const statusColor =
    status === 'above' ? 'text-success' : status === 'below' ? 'text-error' : 'text-text-3';

  const statusLabel =
    status === 'above'
      ? 'Above benchmark'
      : status === 'below'
        ? 'Below benchmark'
        : 'At benchmark';

  const StatusIcon = status === 'above' ? Check : status === 'below' ? X : Minus;

  return (
    <div
      className="flex items-center justify-between py-2 border-b border-hairline last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
      role="listitem"
      aria-label={`Position ${position}: Your CTR ${(actualCtr * 100).toFixed(1)}% versus benchmark ${(benchmarkCtr * 100).toFixed(1)}%. ${statusLabel}.`}
      tabIndex={0}
    >
      <div>
        <span className="text-[13px] text-text-2">Position {position}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-[13px] font-medium tabular-nums text-text-1">
            {(actualCtr * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-text-3">
            vs {(benchmarkCtr * 100).toFixed(1)}% benchmark
          </div>
        </div>
        <div className="flex items-center gap-1">
          <StatusIcon className={`w-3 h-3 ${statusColor}`} aria-hidden="true" />
          <span className={`text-[12px] font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
      </div>
    </div>
  );
}
