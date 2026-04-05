"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface PostSuggestion {
  id: string;
  title: string;
  type: string;
  marketplace: { priceType: string; priceAmount: number | null } | null;
  storage: { priceMonthly: number | null; isFree: boolean } | null;
  housing: { monthlyRent: number | null } | null;
}

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  placeholder?: string;
  inputClassName?: string;
}

export function SearchAutocomplete({
  value,
  onChange,
  onSubmit,
  placeholder = "Search listings...",
  inputClassName = "",
}: SearchAutocompleteProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<PostSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `${API_URL}/api/posts?q=${encodeURIComponent(query)}&limit=5`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.posts || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value.trim());
      setShowDropdown(true);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        onSubmit(value.trim());
        setShowDropdown(false);
      }
      return;
    }

    const totalItems = suggestions.length + 1; // +1 for "Search for..." row

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        router.push(`/posts/${suggestions[activeIndex].id}`);
      } else {
        onSubmit(value.trim());
      }
      setShowDropdown(false);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const formatPrice = (post: PostSuggestion) => {
    if (post.marketplace?.priceType === "free" || post.storage?.isFree) return "Free";
    if (post.marketplace?.priceAmount) return `$${post.marketplace.priceAmount}`;
    if (post.storage?.priceMonthly) return `$${post.storage.priceMonthly}/mo`;
    if (post.housing?.monthlyRent) return `$${post.housing.monthlyRent}/mo`;
    return null;
  };

  const typeColors: Record<string, string> = {
    marketplace: "bg-maroon-100 text-maroon-700",
    storage: "bg-amber-100 text-amber-700",
    housing: "bg-indigo-100 text-indigo-700",
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (value.trim().length >= 2 && suggestions.length > 0) {
            setShowDropdown(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName}
      />

      {showDropdown && value.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-[60]">
          {suggestions.map((post, i) => {
            const price = formatPrice(post);
            return (
              <button
                key={post.id}
                onClick={() => {
                  router.push(`/posts/${post.id}`);
                  setShowDropdown(false);
                }}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  i === activeIndex ? "bg-gray-50" : "hover:bg-gray-50"
                } ${i > 0 ? "border-t border-gray-100" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{post.title}</p>
                </div>
                {price && (
                  <span className="text-sm font-semibold text-maroon-700 shrink-0">
                    {price}
                  </span>
                )}
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize shrink-0 ${
                    typeColors[post.type] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {post.type}
                </span>
              </button>
            );
          })}

          {/* "Search for..." row */}
          <button
            onClick={() => {
              onSubmit(value.trim());
              setShowDropdown(false);
            }}
            className={`w-full text-left px-4 py-3 border-t border-gray-200 transition-colors ${
              activeIndex === suggestions.length ? "bg-gray-50" : "hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-2 text-sm text-maroon-600 font-medium">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              Search for &ldquo;{value.trim()}&rdquo; →
            </div>
          </button>

          {suggestions.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400 border-b border-gray-100">
              No matching posts
            </div>
          )}
        </div>
      )}
    </div>
  );
}
