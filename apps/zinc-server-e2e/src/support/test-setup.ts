import axios from 'axios';
import { inject } from 'vitest';

// Point axios at the server started in global-setup.ts.
axios.defaults.baseURL = inject('baseUrl');
