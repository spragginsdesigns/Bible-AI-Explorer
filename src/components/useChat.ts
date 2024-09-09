import { useState } from "react";

export interface FormattedResponseType {
	content: string;
	keyTakeaways: string[];
	reflectionQuestion: string;
	biblicalReferences: string[];
}

interface HistoryItem {
	id: string;
	question: string;
	answer: string;
	selected: boolean;
}

export const useChat = (initialQuery: string = "") => {
	const [query, setQuery] = useState<string>(initialQuery);
	const [response, setResponse] = useState<FormattedResponseType | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [isTyping, setIsTyping] = useState<boolean>(false);
	const [history, setHistory] = useState<HistoryItem[]>([]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!query.trim()) return;

		setLoading(true);
		setResponse(null);

		try {
			const response = await fetch("/api/ask-question", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ question: query })
			});

			if (!response.ok) {
				throw new Error(`API response was not ok: ${response.status}`);
			}

			const data = await response.json();

			if (!data.response || typeof data.response !== "string") {
				throw new Error("Invalid response format");
			}

			const parsedResponse = parseResponse(data.response);

			setIsTyping(true);
			let i = 0;
			const content = parsedResponse.content;
			const intervalId = setInterval(() => {
				setResponse({
					content: content.slice(0, i),
					keyTakeaways: parsedResponse.keyTakeaways || [],
					reflectionQuestion: parsedResponse.reflectionQuestion || "",
					biblicalReferences: parsedResponse.biblicalReferences || []
				});
				i += 5;
				if (i > content.length) {
					clearInterval(intervalId);
					setIsTyping(false);
					setResponse(parsedResponse);
					setHistory((prev) => [
						...prev,
						{
							id: Date.now().toString(),
							question: query,
							answer: JSON.stringify(parsedResponse),
							selected: false
						}
					]);
				}
			}, 10);
		} catch (error) {
			console.error("Error:", error);
			setResponse({
				content: `An error occurred while processing your request: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				keyTakeaways: [],
				reflectionQuestion: "",
				biblicalReferences: []
			});
		} finally {
			setLoading(false);
			setQuery("");
		}
	};

	const selectHistoryItem = (id: string) => {
		setHistory((prev) =>
			prev.map((item) => ({
				...item,
				selected: item.id === id
			}))
		);
	};

	const clearHistory = () => {
		setHistory([]);
	};

	return {
		query,
		setQuery,
		response,
		loading,
		isTyping,
		history,
		handleSubmit,
		selectHistoryItem,
		clearHistory
	};
};

function parseResponse(response: string): FormattedResponseType {
	const sections = response.split(/\d+\.\s+/);
	return {
		content: sections[1]?.replace("Content:", "").trim() || "",
		keyTakeaways:
			sections[2]
				?.replace("Key Takeaways:", "")
				.trim()
				.split("-")
				.filter(Boolean)
				.map((item) => item.trim()) || [],
		reflectionQuestion:
			sections[3]?.replace("Reflection Question:", "").trim() || "",
		biblicalReferences:
			sections[4]
				?.replace("Biblical References:", "")
				.trim()
				.split("-")
				.filter(Boolean)
				.map((item) => item.trim()) || []
	};
}
