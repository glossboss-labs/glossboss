/**
 * EXAMPLE PAGE — Reference for AI-generated pages.
 * Delete this file when building your app. It exists to show correct patterns.
 */

// ⚠️ Static imports only — no React.lazy()
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router'; // ⚠️ 'react-router', NOT 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'; // ⚠️ Path alias

interface Item {
	id: string;
	name: string;
	created_at: string;
}

export default function ExamplePage() {
	// ⚠️ ALL hooks at top, before any conditional returns
	const { id } = useParams();
	const navigate = useNavigate();
	const [items, setItems] = useState<Item[]>([]); // ⚠️ Initialize as empty array, not undefined
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchItems() {
			if (!supabase) {
				// ⚠️ Supabase client can be null — always check
				setError('Database not connected');
				setLoading(false);
				return;
			}

			const { data, error: fetchError } = await supabase
				.from('items')
				.select('*')
				.order('created_at', { ascending: false });

			if (fetchError) {
				setError(fetchError.message);
			} else {
				setItems(data ?? []); // ⚠️ Fallback to empty array
			}
			setLoading(false);
		}

		fetchItems();
	}, []);

	// ⚠️ navigator.clipboard is BLOCKED in sandbox. Use execCommand fallback.
	const handleCopy = (text: string) => {
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.position = 'fixed';
		textarea.style.opacity = '0';
		document.body.appendChild(textarea);
		textarea.select();
		document.execCommand('copy');
		document.body.removeChild(textarea);
	};

	// ⚠️ Conditional returns AFTER all hooks
	if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
	if (error) return <div className="p-4 text-red-500">{error}</div>;

	return (
		// ⚠️ Use gap-*, not space-y-*
		<div className="flex flex-col gap-4 p-6 max-w-2xl mx-auto">
			<h1 className="text-2xl font-bold">Items {id && `(${id})`}</h1>

			{/* ⚠️ Guard array operations with ?? [] */}
			{(items ?? []).map((item) => (
				<div key={item.id} className="p-4 border border-border rounded-lg">
					<p className="font-medium">{item.name}</p>
					<button onClick={() => handleCopy(item.name)} className="text-sm text-primary">
						Copy name
					</button>
				</div>
			))}

			<button onClick={() => navigate('/')} className="text-sm text-muted-foreground">
				Back Home
			</button>
		</div>
	);
}
