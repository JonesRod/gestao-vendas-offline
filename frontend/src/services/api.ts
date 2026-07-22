import axios from 'axios';

// A URL base aponta para o backend local.
// Se você for acessar de outro celular na mesma rede, 
// troque "localhost" pelo IP do computador servidor (ex: http://192.168.0.15:3000/api)
export const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Interceptor para injetar o Token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@GestaoOffline:token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de resposta: detecta token expirado/inválido (401) e faz logout automático
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpa todos os dados de autenticação
      localStorage.removeItem('@GestaoOffline:token');
      localStorage.removeItem('@GestaoOffline:role');
      localStorage.removeItem('@GestaoOffline:user');
      // Redireciona para o login se não estiver já na página de login
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/store')) {
        window.location.href = '/login';
      } else if (window.location.pathname.includes('/store') && !window.location.pathname.includes('/store/login')) {
        window.location.href = '/store/login';
      }
    }
    return Promise.reject(error);
  }
);
