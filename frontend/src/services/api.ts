import axios from 'axios';

// A URL base aponta para o backend local.
// Se você for acessar de outro celular na mesma rede, 
// troque "localhost" pelo IP do computador servidor (ex: http://192.168.0.15:3000/api)
export const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Interceptor para injetar o Token em todas as requisições (Fase 3 da Autenticação)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@GestaoOffline:token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
