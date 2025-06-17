import React from "react";

interface MeetingInsight {
  type: string;
  data: any[];
}

interface InsightsTabContentProps {
  insights: MeetingInsight[];
  isSaving: boolean;
}

export const InsightsTabContent = ({ insights, isSaving }: InsightsTabContentProps) => {
  return (
    <div className="mt-4 space-y-4">
      {insights.map((category) => {
        if (category.type === "emotions" && category.data.length > 0) {
          return (
            <div key={category.type} className="border rounded-md p-4">
              <h3 className="font-medium mb-3 text-indigo-400">Client Emotions</h3>
              <div className="space-y-2">
                {category.data.map((item: { emotion: string; level: number }, index: number) => (
                  <div key={index} className="mb-2">
                    <div className="flex justify-between mb-1">
                      <span>{item.emotion}</span>
                      <span>{item.level}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                        style={{ width: `${item.level}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const categoryTitles: Record<string, { title: string; color: string }> = {
          painPoints: { title: "Pain Points", color: "text-red-400" },
          objections: { title: "Potential Objections", color: "text-amber-400" },
          recommendations: { title: "Focus Next", color: "text-emerald-400" },
          nextActions: { title: "Next Actions", color: "text-blue-400" },
        };

        const categoryInfo = categoryTitles[category.type];
        if (!categoryInfo || category.data.length === 0) return null;

        return (
          <div key={category.type} className="border rounded-md p-4">
            <h3 className={`font-medium mb-3 ${categoryInfo.color}`}>{categoryInfo.title}</h3>
            <ul className="list-disc pl-5 space-y-1">
              {category.data.map((item: string, index: number) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}; 