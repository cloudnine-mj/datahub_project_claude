export function DeveloperTools() {
  return (
    <section className="border-t border-dh-border bg-bg-surface">
      <div className="mx-auto max-w-[1440px] px-6 py-12">
        <h2 className="font-heading text-xl font-semibold text-text-primary mb-2">Developer Tools</h2>
        <p className="text-sm text-text-secondary mb-8">SDK와 CLI로 DataHub를 코드에서 직접 사용하세요.</p>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Python SDK */}
          <div className="rounded-xl border border-dh-border bg-white p-6">
            <h3 className="font-heading text-sm font-semibold text-text-primary mb-1">Python SDK</h3>
            <p className="text-xs text-text-secondary mb-4">데이터셋 및 모델을 Python에서 직접 관리</p>
            <div className="rounded-lg bg-bg-code p-4 font-mono text-xs text-text-primary">
              <p className="text-text-muted"># 설치</p>
              <p>pip install datahub-python</p>
              <p className="mt-3 text-text-muted"># 사용 예시</p>
              <p>import datahub</p>
              <p>ds = datahub.Dataset(<span className="text-accent-green">&quot;lgair/my-dataset&quot;</span>)</p>
              <p>ds.push(<span className="text-accent-green">&quot;./data.parquet&quot;</span>)</p>
            </div>
          </div>

          {/* CLI */}
          <div className="rounded-xl border border-dh-border bg-white p-6">
            <h3 className="font-heading text-sm font-semibold text-text-primary mb-1">CLI</h3>
            <p className="text-xs text-text-secondary mb-4">터미널에서 DataHub 리소스를 빠르게 관리</p>
            <div className="rounded-lg bg-bg-code p-4 font-mono text-xs text-text-primary">
              <p className="text-text-muted"># 설치</p>
              <p>pip install datahub-cli</p>
              <p className="mt-3 text-text-muted"># 사용 예시</p>
              <p><span className="text-accent-blue">datahub</span> login</p>
              <p><span className="text-accent-blue">datahub</span> clone lgair/my-dataset</p>
              <p><span className="text-accent-blue">datahub</span> push .</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
