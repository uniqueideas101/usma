import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type SchemeChartEntry = {
  name: string
  applications: number
}

export default function SchemeApplicationsChart({ data }: { data: SchemeChartEntry[] }) {
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 10, bottom: 4, left: 0 }}>
      <CartesianGrid stroke="#e9ebef" horizontal={false} />
      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
      <YAxis type="category" dataKey="name" width={172} interval={0} tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
      <Tooltip cursor={{ fill: '#f3f5f8' }} />
      <Bar dataKey="applications" name="Applications" fill="#2c3e70" radius={[0, 5, 5, 0]} barSize={18} />
    </BarChart>
  </ResponsiveContainer>
}
