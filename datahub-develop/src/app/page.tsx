import { getPlatformToken } from "@/lib/session";
import { Header } from "@/components/layout/header";
import { HomeHero } from "@/components/home/home-hero";
import { TrendingRepos } from "@/components/home/trending-repos";
import { DeveloperTools } from "@/components/home/developer-tools";
import { HomeFooter } from "@/components/home/home-footer";

export default async function RootPage() {
  const token = await getPlatformToken();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <HomeHero isLoggedIn={!!token} />
        <TrendingRepos />
        <DeveloperTools />
      </main>
      <HomeFooter />
    </div>
  );
}
