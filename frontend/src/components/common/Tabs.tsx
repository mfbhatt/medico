interface TabsProps {
  tabs: Array<{
    id: string;
    label: string;
    content: React.ReactNode;
  }>;
  defaultTab?: string;
}

export default function Tabs({ tabs, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id || "");

  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-semibold text-sm transition border-b-2 ${activeTab === tab.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-600 hover:text-gray-900"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="py-4">{activeTabData?.content}</div>
    </div>
  );
}

import * as React from "react";
