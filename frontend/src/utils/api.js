const API_BASE_URL = process.env.REACT_APP_API_URL || '';

/**
 * Wrapper around fetch that prepends the API base URL.
 *
 * Args:
 *   path (string): The API path, starting with '/'.
 *   options (object): Fetch options.
 *
 * Returns:
 *   Promise<Response>: The fetch response promise.
 */
function apiFetch(path, options = {}) {
  return fetch(API_BASE_URL + path, options);
}

export { API_BASE_URL, apiFetch };
