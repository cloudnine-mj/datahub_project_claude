import Link from "next/link";
import { Brain, Database, Star, GitFork } from "lucide-react";

// Placeholder data — will be replaced with API data
const trendingItems = [
  {
    type: "model" as const,
    group: "lgair",
    name: "exaone-3.5-instruct",
    description: "LGAI Research의 한국어 특화 대형 언어 모델",
    stars: 142,
    forks: 23,
    updatedAt: "2시간 전",
  },
  {
    type: "dataset" as const,
    group: "lgair",
    name: "korean-qa-benchmark",
    description: "한국어 질의응답 벤치마크 데이터셋",
    stars: 87,
    forks: 15,
    updatedAt: "1일 전",
  },
  {
    type: "model" as const,
    group: "lgair",
    name: "vision-encoder-base",
    description: "이미지-텍스트 멀티모달 인코더 모델",
    stars: 64,
    forks: 11,
    updatedAt: "3일 전",
  },
  {
    type: "dataset" as const,
    group: "lgai-research",
    name: "multimodal-train-v2",
    description: "멀티모달 학습용 이미지-텍스트 페어 데이터셋",
    stars: 55,
    forks: 8,
    updatedAt: "5일 전",
  },
];

export function TrendingRepos() {
  return (
    <section className="mx-auto max-w-[1440px] px-6 py-12">
      <h2 className="font-heading text-xl font-semibold text-text-primary mb-6">Trending Repositories</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {trendingItems.map((item) => {
          const isModel = item.type === "model";
          return (
            <Link
              key={`${item.group}/${item.name}`}
              href={`/${item.group}/${item.name}`}
              className="flex items-start gap-3 rounded-xl border border-dh-border bg-white p-4 transition-all hover:border-accent-blue/30 hover:shadow-sm"
            >
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  isModel ? "bg-blue-50" : "bg-red-50"
                }`}
              >
                {isModel ? (
                  <Brain className="h-4 w-4 text-accent-blue" />
                ) : (
                  <Database className="h-4 w-4 text-brand" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">
                  <span className="text-text-secondary">{item.group}</span>
                  <span className="text-text-muted mx-1">/</span>
                  {item.name}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary line-clamp-1">{item.description}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
                  <span
                    className={`font-medium ${isModel ? "text-accent-blue" : "text-brand"}`}
                  >
                    {isModel ? "Model" : "Dataset"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {item.stars}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork className="h-3 w-3" />
                    {item.forks}
                  </span>
                  <span>{item.updatedAt}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
