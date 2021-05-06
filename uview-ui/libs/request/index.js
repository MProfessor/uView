import deepMerge from '../function/deepMerge'
import validate from '../function/test'
class Request {
  // 设置全局默认配置
  setConfig(customConfig) {
    // 深度合并对象，否则会造成对象深层属性丢失
    this.config = deepMerge(this.config, customConfig)
  }

  // 主要请求部分
  async request(options = {}) {
    // interceptHandler
    const interceptHandler = async (handler, data) => {
      // 检查请求拦截
      if (handler && typeof handler === 'function') {
        let result = await handler(data)
        if (!result) {
          return Promise.reject('拦截器返回false 请检查代码', result)
        }
        return result
      } else {
        return data
      }
    }
    options.dataType = options.dataType || this.config.dataType
    options.responseType = options.responseType || this.config.responseType
    options.url = options.url || ''
    options.params = options.params || {}
    options.header = Object.assign({}, this.config.header, options.header)
    options.method = options.method || this.config.method

    // 判断用户传递的URL是否/开头,如果不是,加上/，这里使用了uView的test.js验证库的url()方法
    options.url = validate.url(options.url) ? options.url : this.config.baseUrl + (options.url.indexOf('/') == 0 ? options.url : '/' + options.url)
    const changes = await interceptHandler(this.interceptor.request, options)
    options = { ...options, ...changes }
    console.log('options', options)
    // 是否显示loading
    // 加一个是否已有timer定时器的判断，否则有两个同时请求的时候，后者会清除前者的定时器id
    // 而没有清除前者的定时器，导致前者超时，一直显示loading
    if (this.config.showLoading && !this.config.timer) {
      this.config.timer = setTimeout(() => {
        uni.showLoading({
          title: this.config.loadingText,
          mask: this.config.loadingMask
        })
        this.config.timer = null
      }, this.config.loadingTime)
    }
    const responseHandler = async (response) => {
      // 请求返回后，隐藏loading(如果请求返回快的话，可能会没有loading)
      uni.hideLoading()
      // 清除定时器，如果请求回来了，就无需loading
      clearTimeout(this.config.timer)
      this.timer = null
      // 判断用户对拦截返回数据的要求，如果originalData为true，返回所有的数据(response)到拦截器，否则只返回response.data
      if (this.config.originalData) {
        const resData = await interceptHandler(this.interceptor.response, response)
        return resData
      } else {
        if (response.statusCode == 200) {
          const resData = await interceptHandler(this.interceptor.response, response.data)
          return resData
        } else {
          // 不返回原始数据的情况下，服务器状态码不为200，modal弹框提示
          uni.showModal({
            title: response.errMsg || '请求错误'
          })
          return Promise.reject(response.errMsg || '请求错误')
        }
      }
    }
    const http = async () => {
      const callbackData = await uni.request(options)
      const [error, data] = callbackData
      const response = await responseHandler(data)
      return response
    }
    return http()
    // .catch(res => {
    // 	// 如果返回reject()，不让其进入this.$u.post().then().catch()后面的catct()
    // 	// 因为很多人都会忘了写后面的catch()，导致报错捕获不到catch
    // 	return new Promise(()=>{});
    // })
  }

  constructor() {
    this.config = {
      baseUrl: '', // 请求的根域名
      // 默认的请求头
      header: {},
      method: 'POST',
      // 设置为json，返回后uni.request会对数据进行一次JSON.parse
      dataType: 'json',
      // 此参数无需处理，因为5+和支付宝小程序不支持，默认为text即可
      responseType: 'text',
      showLoading: true, // 是否显示请求中的loading
      loadingText: '请求中...',
      loadingTime: 800, // 在此时间内，请求还没回来的话，就显示加载中动画，单位ms
      timer: null, // 定时器
      originalData: false, // 是否在拦截器中返回服务端的原始数据，见文档说明
      loadingMask: true // 展示loading的时候，是否给一个透明的蒙层，防止触摸穿透
    }

    // 拦截器
    this.interceptor = {
      // 请求前的拦截
      request: null,
      // 请求后的拦截
      response: null
    }

    // get请求
    this.get = (url, data = {}, header = {}) => {
      return this.request({
        method: 'GET',
        url,
        header,
        data
      })
    }

    // post请求
    this.post = (url, data = {}, header = {}) => {
      return this.request({
        url,
        method: 'POST',
        header,
        data
      })
    }

    // put请求，不支持支付宝小程序(HX2.6.15)
    this.put = (url, data = {}, header = {}) => {
      return this.request({
        url,
        method: 'PUT',
        header,
        data
      })
    }

    // delete请求，不支持支付宝和头条小程序(HX2.6.15)
    this.delete = (url, data = {}, header = {}) => {
      return this.request({
        url,
        method: 'DELETE',
        header,
        data
      })
    }
  }
}
export default new Request()
