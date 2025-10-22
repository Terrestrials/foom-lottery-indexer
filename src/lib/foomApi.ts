import axios from 'axios'

const foomApi = axios.create({
  baseURL: 'https://api-foom.degen.pl/v1',
  timeout: 120000,
})

export default foomApi
