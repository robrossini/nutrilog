import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Flame, Target } from "lucide-react";

interface MacrosSummaryProps {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  calorieGoal?: number;
  proteinGoal?: number;
  carbsGoal?: number;
  fatGoal?: number;
}

export function MacrosSummary({
  totalCalories,
  totalProtein,
  totalCarbs,
  totalFat,
  calorieGoal = 2000,
  proteinGoal = 150,
  carbsGoal = 180,
  fatGoal = 70,
}: MacrosSummaryProps) {
  const macroData = [
    { name: "Protein", value: totalProtein * 4, grams: totalProtein, color: "#ef4444" },
    { name: "Carbs", value: totalCarbs * 4, grams: totalCarbs, color: "#eab308" },
    { name: "Fat", value: totalFat * 9, grams: totalFat, color: "#3b82f6" },
  ];

  const calorieProgress = Math.min((totalCalories / calorieGoal) * 100, 100);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Flame className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Today&apos;s Calories</p>
              <p className="text-3xl font-bold text-gray-900">
                {totalCalories}
                <span className="text-lg text-gray-500 font-normal"> / {calorieGoal}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Remaining</p>
            <p className="text-2xl font-semibold text-gray-900">
              {Math.max(calorieGoal - totalCalories, 0)}
            </p>
          </div>
        </div>

        <div className="w-full bg-white rounded-full h-3 overflow-hidden shadow-inner">
          <div
            className="bg-gradient-to-r from-orange-500 to-red-500 h-full transition-all duration-500 rounded-full"
            style={{ width: `${calorieProgress}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Macro Breakdown</h3>
        </div>

        {totalCalories > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(((percent as number) || 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    dataKey="value"
                  >
                    {macroData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `${props?.payload?.grams ?? 0}g (${Math.round(value)} cal)`,
                      props?.payload?.name ?? "",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4 flex flex-col justify-center">
              <MacroLegendRow
                label="Protein"
                value={`${totalProtein}g / ${proteinGoal}g`}
                swatch="bg-red-500"
                bg="bg-red-50"
              />
              <MacroLegendRow
                label="Carbs"
                value={`${totalCarbs}g / ${carbsGoal}g`}
                swatch="bg-yellow-500"
                bg="bg-yellow-50"
              />
              <MacroLegendRow
                label="Fat"
                value={`${totalFat}g / ${fatGoal}g`}
                swatch="bg-blue-500"
                bg="bg-blue-50"
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Log your first meal to see your macro breakdown</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MacroLegendRow({
  label,
  value,
  swatch,
  bg,
}: {
  label: string;
  value: string;
  swatch: string;
  bg: string;
}) {
  return (
    <div className={`flex items-center justify-between p-3 ${bg} rounded-lg`}>
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${swatch}`} />
        <span className="font-medium text-gray-900">{label}</span>
      </div>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}