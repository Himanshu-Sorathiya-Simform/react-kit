import { useMemo } from "react";
import { getValue } from "../../shared/utils.ts";
import type {
	FlatIndexedItem,
	FuzzySearchOptions,
	IndexedToken,
	ScoredItem,
} from "./types.ts";
import { calculateScore } from "./utils.ts";

type UseFuzzySearchFields<T> = {
	field: Extract<keyof T, string>;
	weight: number;
}[];
type UseFuzzySearchReturn<T> = T[];

function useFuzzySearch<T>(
	data: T[],
	query: string,
	fields: UseFuzzySearchFields<T>,
	options: FuzzySearchOptions = {},
): UseFuzzySearchReturn<T> {
	const targetThreshold = options.threshold ?? 0.01;
	const isCaseSensitive = options.caseSensitive ?? false;
	const matchStrategy = options.matchStrategy ?? "any";
	const exactPhraseBonus = options.exactPhraseBonus ?? true;

	const indexedData = useMemo(() => {
		if (fields.length === 0 || data.length === 0) {
			return [];
		}

		return data.map((item, index): FlatIndexedItem<T> => {
			const tokens: IndexedToken[] = [];
			const rawTextPieces: string[] = [];

			for (const { field, weight } of fields) {
				const fieldValue = getValue(item, field);

				if (Array.isArray(fieldValue)) {
					for (const arrayValue of fieldValue) {
						if (
							arrayValue !== null
							&& arrayValue !== undefined
							&& arrayValue !== ""
							&& typeof arrayValue !== "object"
						) {
							const strVal = String(arrayValue);
							rawTextPieces.push(strVal);

							const individualWords = strVal
								.split(/[^a-z0-9]+/i)
								.filter((w) => w.length > 0);

							for (const word of individualWords) {
								tokens.push({ text: word, weight });
							}
						}
					}
				} else if (
					fieldValue !== null
					&& fieldValue !== undefined
					&& fieldValue !== ""
					&& typeof fieldValue !== "object"
				) {
					const strVal = String(fieldValue);
					rawTextPieces.push(strVal);

					const individualWords = strVal
						.split(/[^a-z0-9]+/i)
						.filter((w) => w.length > 0);

					for (const word of individualWords) {
						tokens.push({ text: word, weight });
					}
				}
			}

			const combinedFlatText = rawTextPieces.join(" ");

			return { item, index, tokens, combinedFlatText };
		});
	}, [data, fields]);

	const filteredAndSortedData = useMemo(() => {
		const sanitizedQuery = query.trim();

		if (!sanitizedQuery || indexedData.length === 0) {
			return data;
		}

		const queryTokens = sanitizedQuery
			.split(/\s+/)
			.filter((token) => token.length > 0);

		if (queryTokens.length === 0) {
			return data;
		}

		const scoredItems: ScoredItem<T>[] = [];
		const MIN_TOKEN_MATCH_SCORE = 0.3;

		for (const row of indexedData) {
			let totalRowScore = 0;
			let matchedQueryTokensCount = 0;
			let failedStrategy = false;

			for (const qToken of queryTokens) {
				let maxQTokenScore = 0;
				const normQToken = isCaseSensitive ? qToken : qToken.toLowerCase();

				for (const dToken of row.tokens) {
					const normDToken =
						isCaseSensitive ? dToken.text : dToken.text.toLowerCase();

					const dataWords = normDToken
						.split(/\s+/)
						.filter((w) => w.length > 0);

					for (const word of dataWords) {
						const hasInternalSubstring = word.includes(normQToken);

						if (!hasInternalSubstring) {
							if (word.length < qToken.length / 2) continue;

							const lengthDiff = Math.abs(qToken.length - word.length);
							const maxLength = Math.max(qToken.length, word.length);
							if (
								maxLength > 0
								&& (maxLength - lengthDiff) / maxLength
									< MIN_TOKEN_MATCH_SCORE
							) {
								continue;
							}
						}

						const baseScore = calculateScore(
							qToken,
							word,
							isCaseSensitive,
						);
						const weightedScore = baseScore * dToken.weight;

						if (weightedScore > maxQTokenScore) {
							maxQTokenScore = weightedScore;
						}
					}
				}

				if (maxQTokenScore >= MIN_TOKEN_MATCH_SCORE) {
					matchedQueryTokensCount++;
				}

				totalRowScore += maxQTokenScore;
			}

			if (
				matchStrategy === "all"
				&& matchedQueryTokensCount < queryTokens.length
			) {
				failedStrategy = true;
			}

			if (!failedStrategy) {
				let finalScore = totalRowScore / queryTokens.length;

				if (exactPhraseBonus && queryTokens.length > 1) {
					const escapedQueryPattern = queryTokens
						.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
						.join("\\s+");

					const dynamicRegex = new RegExp(
						escapedQueryPattern,
						isCaseSensitive ? "g" : "gi",
					);

					if (dynamicRegex.test(row.combinedFlatText)) {
						finalScore += 0.15;
					}
				}

				if (finalScore >= targetThreshold) {
					scoredItems.push({
						item: row.item,
						score: finalScore,
						index: row.index,
					});
				}
			}
		}

		const sortedItems = scoredItems.toSorted((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}

			return a.index - b.index;
		});

		return sortedItems.map((record) => record.item);
	}, [
		indexedData,
		data,
		query,
		targetThreshold,
		isCaseSensitive,
		matchStrategy,
		exactPhraseBonus,
	]);

	return filteredAndSortedData;
}

export { type UseFuzzySearchFields, type UseFuzzySearchReturn, useFuzzySearch };
