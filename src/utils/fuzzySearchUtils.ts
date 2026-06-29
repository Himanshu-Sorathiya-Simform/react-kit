function calculateScore(
	query: string,
	text: string,
	isCaseSensitive: boolean = false,
): number {
	let q = query.trim();
	let t = text.trim();

	const isShorthand = q.length > 1 && q === q.toUpperCase() && /^[A-Z]+$/.test(q);

	if (!isCaseSensitive) {
		q = q.toLowerCase();
		t = t.toLowerCase();
	}

	if (q === t) return 1.0;

	if (q === "") return 0.0;
	if (t === "") return 0.0;

	if (isShorthand) {
		const words = t.split(/[^a-z0-9]+/i).filter((w) => w.length > 0);

		if (words.length >= q.length) {
			let shorthandMatchCount = 0;
			let wordPointer = 0;

			for (let i = 0; i < q.length; i++) {
				const shorthandChar = q[i];
				while (wordPointer < words.length) {
					const targetWord = words[wordPointer] ?? "";

					if (targetWord[0] === shorthandChar) {
						shorthandMatchCount++;
						wordPointer++;
						break;
					}
					wordPointer++;
				}
			}

			if (shorthandMatchCount === q.length) {
				return 0.85;
			}
		}
	}

	let hasCharOverlap = false;
	for (let i = 0; i < q.length; i++) {
		if (t.includes(q[i] ?? "")) {
			hasCharOverlap = true;

			break;
		}
	}

	if (!hasCharOverlap) return 0.0;

	const subIdx = t.indexOf(q);
	if (subIdx !== -1) {
		const isPrefix = subIdx === 0;
		const positionPenalty = (subIdx / t.length) * (isPrefix ? 0.01 : 0.1);
		const lengthPenalty =
			((t.length - q.length) / t.length) * (isPrefix ? 0.01 : 0.05);

		return Math.max(0.7, 0.95 - positionPenalty - lengthPenalty);
	}

	let matchedCount = 0;
	let lastIdx = -1;
	let totalDistance = 0;
	let outOfOrderCount = 0;
	let searchStartIdx = 0;

	for (let i = 0; i < q.length; i++) {
		const char = q[i];

		if (!char) continue;

		const matchIdx = t.indexOf(char, searchStartIdx);

		if (matchIdx !== -1) {
			matchedCount++;

			if (lastIdx !== -1) {
				if (matchIdx > lastIdx) {
					totalDistance += matchIdx - lastIdx;
				} else {
					outOfOrderCount++;
					totalDistance += 1;
				}
			}

			lastIdx = matchIdx;
			searchStartIdx = matchIdx + 1;

			if (searchStartIdx >= t.length) searchStartIdx = 0;
		} else {
			const fallbackIdx = t.indexOf(char);

			if (fallbackIdx !== -1) {
				matchedCount++;
				outOfOrderCount++;
				lastIdx = fallbackIdx;
				searchStartIdx = fallbackIdx + 1;
			}
		}
	}

	if (matchedCount < q.length / 2) {
		return 0.0;
	}

	const matchRatio = matchedCount / q.length;

	const orderMultiplier = Math.pow(0.6, outOfOrderCount);

	const averageGap = matchedCount > 1 ? totalDistance / (matchedCount - 1) : 1;
	const gapMultiplier = Math.max(0.4, 1 - averageGap / t.length);

	const finalScore = matchRatio * orderMultiplier * gapMultiplier;

	const looseMatchPenalty = 0.45;
	return Math.max(0.0, finalScore * looseMatchPenalty);
}

export { calculateScore };
