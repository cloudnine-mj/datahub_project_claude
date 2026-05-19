"use client";

/**
 * Typeahead 자동완성 입력 컴포넌트.
 *
 * 사용자가 입력할 때마다 ``fetchOptions(q)`` 를 호출해 서버 측 결과를 가져와
 * dropdown 으로 노출. 선택 시 ``onSelect(item)`` 호출 + 입력 초기화.
 *
 * Access Token 위저드의 repo / group 자동완성에 사용:
 *   <TypeaheadInput
 *     placeholder="레포 검색..."
 *     fetchOptions={searchRepos}
 *     renderItem={(r) => `${r.repo_name} — ${r.visibility}`}
 *     onSelect={(r) => addRepoChip(r.repo_name)}
 *   />
 */

import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

interface Props<T> {
  placeholder?: string;
  fetchOptions: (query: string) => Promise<T[]>;
  renderItem: (item: T) => string;
  /** dropdown row 의 키. 동일 식별자 중복 노출 방지. */
  itemKey: (item: T) => string;
  onSelect: (item: T) => void;
  /** 이미 선택된 식별자들. 결과에서 제외. */
  exclude?: ReadonlySet<string>;
  /** 입력 1회당 fetch debounce ms. 기본 200. */
  debounceMs?: number;
}

export function TypeaheadInput<T>({
  placeholder,
  fetchOptions,
  renderItem,
  itemKey,
  onSelect,
  exclude,
  debounceMs = 200,
}: Props<T>) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // debounced fetch
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await fetchOptions(q);
        if (cancelled) return;
        const filtered = exclude
          ? result.filter((r) => !exclude.has(itemKey(r)))
          : result;
        setItems(filtered);
      } catch {
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q, fetchOptions, itemKey, exclude, debounceMs]);

  // outside click 으로 dropdown 닫기
  useEffect(() => {
    function onClick(ev: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSelect = (item: T) => {
    onSelect(item);
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={q}
        placeholder={placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        spellCheck={false}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-y-auto rounded-md border bg-white shadow-lg max-h-64">
          {loading && (
            <div className="px-3 py-2 text-sm text-gray-500">검색 중...</div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              {q ? "결과 없음" : "타이핑하면 자동완성됩니다"}
            </div>
          )}
          {!loading &&
            items.slice(0, 20).map((item) => (
              <button
                key={itemKey(item)}
                type="button"
                className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-gray-100"
                onClick={() => handleSelect(item)}
              >
                {renderItem(item)}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
