import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { ConfigProvider, App as AntApp } from 'antd'
import App from './App'
import { store } from './store/store'
import 'antd/dist/reset.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ConfigProvider>
        <AntApp>
          <App />
        </AntApp>
      </ConfigProvider>
    </Provider>
  </React.StrictMode>,
)
