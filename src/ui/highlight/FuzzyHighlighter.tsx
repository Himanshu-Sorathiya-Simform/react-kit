import React from "react";

interface FuzzyHighlighterProps {
	text: string;
	query: string;
	className?: string;
	caseSensitive?: boolean;
}

function FuzzyHighlighter({
	text,
	query,
	className = "",
	caseSensitive = false,
}: FuzzyHighlighterProps): React.JSX.Element {
	const sanitizedQuery = query.trim();

	if (!sanitizedQuery || !text) {
		return <>{text}</>;
	}

	const queryTokens = sanitizedQuery
		.split(/\s+/)
		.filter((token) => token.length > 0);

	if (queryTokens.length === 0) {
		return <>{text}</>;
	}

	const combinedClassName = `fuzzy-highlight ${className}`.trim();

	const sortedTokens = [...queryTokens].sort((a, b) => b.length - a.length);

	const escapedTokens = sortedTokens.map((t) =>
		t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
	);

	const patternParts = [...escapedTokens];

	if (escapedTokens.length > 1) {
		const sequentialPattern = queryTokens
			.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
			.join("\\s+");

		patternParts.unshift(sequentialPattern);
	}

	const isShorthand =
		sanitizedQuery.length > 1
		&& sanitizedQuery === sanitizedQuery.toUpperCase()
		&& /^[A-Z]+$/.test(sanitizedQuery);

	if (isShorthand) {
		const acronymPattern = sanitizedQuery
			.split("")
			.map((char) => `\\b${char}`)
			.join("[^a-z0-9]*");
		patternParts.unshift(acronymPattern);
	}

	const regexPattern = `(${patternParts.join("|")})`;
	const regex = new RegExp(regexPattern, caseSensitive ? "g" : "gi");

	const parts = text.split(regex);

	return (
		<>
			{parts.map((part, index) => {
				if (regex.test(part)) {
					return (
						<strong
							key={index}
							className={combinedClassName}
						>
							{part}
						</strong>
					);
				}

				return part;
			})}
		</>
	);
}

export { type FuzzyHighlighterProps, FuzzyHighlighter };
