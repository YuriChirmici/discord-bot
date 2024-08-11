import { useState, useCallback } from "react";

const useApi = () => {
	const [ data, setData ] = useState(null);
	const [ error, setError ] = useState(null);
	const [ loading, setLoading ] = useState(false);

	const fetchApi = useCallback(async (url, options = {}) => {
		setLoading(true);
		setError(null);

		try {
			const response = await fetch(url, options);
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			const result = await response.json();
			setData(result);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}, [ ]);

	return { fetchApi, data, error, loading };
};

export default useApi;
