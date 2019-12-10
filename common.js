import Vue from 'vue'
import Vuex from 'vuex'
Vue.use(Vuex);

var globalData={
    http:"",
	imageUrl:"",
	uploadUrl:"",
	coordinate:"",
	cityName:"",
	SessionId:"",
	code:"",
	openId: '',
};
//添加缓存
const setStorage=function(key, data) {
	return new Promise((resolve, reject) => {
		uni.setStorage({
			key: key,
			data: data,
			success: function (res) {
				resolve(true);
			}, fail: function (res) {
				resolve(false);
			}
		})
	})
};
//获取缓存
const getStorage=function(key) {
	return new Promise((resolve, reject) => {
		uni.getStorage({
			key: key,
			success: function (res) {
				const data=res.data;
				resolve(data);
				if(key=='coordinate'&& data){
					globalData.coordinate=data;
				};
			}, fail: function (res) {
				resolve(null);
			}
		})
	})
};
// #ifdef MP-WEIXIN
	// 授权登录
	const wxLogin=function() {
		// 1.wx获取登录用户code
		return new Promise((resolve, reject) => {
			uni.getProvider({
				service: 'oauth',
				success: function (res) {
					console.log(res)
				}
			});
			uni.login({
				provider: 'weixin',
				success: function(loginRes) {
					var parms={
						code:loginRes.code
					};
					globalData.code = loginRes.code;
					console.log("获取code")
					resolve(loginRes.code);
					// PostData('oauth/get_sessionKey',parms,"",true).then(function (res) {
					// 	if (res.code==0) {
					// 		globalData.SessionId = res.data;
					// 		resolve(res)
					// 	} else {
					// 		uni.showToast({
					// 			icon: "none",
					// 			title: '用户授权失败，请重试', // 文字内容
					// 		});
					// 		resolve(false)
					// 	}
					// })
				},
			});
		})
	};
	// 判断是否过期进行授权解密
	const GetAuthorization=function(encryptedData, iv) {
		return new Promise((resolve, reject) => {
			var params= {
				encryptedData: encryptedData,
				iv: iv,
			};
			if (globalData.code == '') {//没有登录
				wxLogin().then(function(res){
					if(res){
						Decrypt(params).then(function (res) {
							resolve(res)
						});
					}
				})
			} else {
				uni.checkSession({//检查登陆过期
					success() {
						Decrypt(params).then(function (res) {
							resolve(res)
						});
					},
					fail() {
						wxLogin().then(function(res){
							if(res){
								Decrypt(params).then(function (res) {
									resolve(res)
								});
							}
						})
					}
				})
			}
		});
	}
	// 解密用户信息
	const Decrypt=function(params){
		return new Promise((resolve, reject) => {
			var param = {
				code:globalData.code,
				encryptedData: params.encryptedData,
				iv: params.iv,
				position: globalData.coordinate,
				cityName: globalData.cityName,
			};
			PostData('', param, "", true).then(function (res) {
				if (res.code!=0) {
					if (res.code == 20002) {
						wxLogin();
					};
					uni.showToast({
						icon: "none",
						title: res.msg, // 文字内容
					});
					resolve(null);
				}else{
					globalData.openId = res.data.openId;
					setStorage('headImgurl', res.data.headImgurl);
					setStorage('nickName', res.data.nickName);
					setStorage('cookieid', res.data.sessionID);
					setStorage('openId', res.data.openId);
					resolve(res.data);
				}
			});
		})
	}
// #endif
// 数据请求
const PostData=function(url, params, method,usejson) {
    return new Promise((resolve, reject) => {
		getStorage("cookieid").then(function(res){
			uni.request({
				url: url.indexOf('http') > -1? url : (globalData.http + url), 
				data:params,
				method: method == '' ||method == null? 'post' : method,
				dataType: 'json',
				header:{
					'cookie':res?"SESSION="+res:'',
					'content-type':usejson?"application/json":'application/x-www-form-urlencoded'
				},
				success: (response) => {
					if(response.data.code==21000){//登陆过期
						uni.redirectTo({
							url:'../../login/login'
						})	
					}else{
						if(!response.data.success){
							if(response.data.code!=22000){//用户未绑定手机
								uni.showToast({
									title: response.data.msg,
									icon: 'none',
									duration: 2000
								})
							}
						}
						resolve(response.data);
					}
				},
				fail:(err)=>{
					uni.hideLoading();
					uni.showToast({
						title: '请求失败',
						icon: 'none',
						duration: 2000
					})
					reject(err)	
				}
			});
		});
    })
};
//发送验证码
const sendSMS=function(mobilePhone) {
	return new Promise((resolve, reject) => {
		if(/^1[345678]\d{9}$/.test(mobilePhone)){
			uni.showToast({
			  title: '发送中,请等待',
			  icon: 'loading',
			});
			PostData('', {mobile: mobilePhone}, '', true).then(function (result) {
				uni.hideToast();
				if (result.success) {// 发送成功
				  uni.showToast({
					title: '验证码已发送',
					icon: 'success'
				  })
				  resolve(true)
				} else {//失败
				  uni.showToast({
					title: result.msg,
					icon: 'none'
				  });
				  resolve(false)
				}
			  });
		}else{
			uni.showToast({
				title: '请输入正确的手机号',
				icon:'none',
			});
		}
	})
};
//获取支付链接
const payOrder=function(orderSn, body) {
    return new Promise((resolve, reject) => {
		var parms={
			orderSN: orderSn, 
			body: body,
		};
		PostData('', parms, '', true).then(function (json) {
			uni.requestPayment({
				provider: 'wxpay',
				timeStamp: json.data.timeStamp+"",
				nonceStr: json.data.nonceStr,
				package: json.data.packages,
				signType: 'MD5',
				paySign: json.data.paySign,
				success: function (res) {
					var param={
						messageType: "支付成功",
						orderSN: orderSn
					};
					// console.log(res)
					// console.log(res.errMsg)
					if (res.errMsg.indexOf('fail')==-1) {
						PostData('', param, "", true).then(function (res1) {
							console.log("推送成功")
						});
					};
					resolve(res)
				},
				fail: function (err) {
					resolve(err)
				}
			});
		})
    })
};
// 调出用户设置
const setting=function() {
    return new Promise((resolve, reject) => {
		uni.openSetting({
			success(res) {
			  if (res.authSetting["scope.userLocation"]) {//定位授权失败
				GetLocation().then(function(res){
					if(res){
						resolve(true);
					}
				});
			  } else {
				resolve(false);
			  };
			  // if (res.authSetting["scope.address"] != undefined) {//防止用户先点击定位，触发else
			  //   if (res.authSetting["scope.address"]) {//地址库授权
			  //     _this.globalData.alowaddress = true;
			  //   } else {
			  //     _this.globalData.alowaddress = false;
			  //   };
			  // };
			  // if (res.authSetting["scope.writePhotosAlbum"]) {//保存到本地
			  //   _this.globalData.authorizeimg = true;
			  // } else {
			  //   _this.globalData.authorizeimg = false;
			  // };
			},
			fail(res){
				console.log(res)
			}
		})
	})
};
//获取当前位置
const GetLocation=function() {
    return new Promise((resolve, reject) => {
		console.log("获取位置");
		uni.getLocation({
			type: 'wgs84',
			success: function (res) {
				console.log(res);
				globalData.coordinate=res.longitude+' '+res.latitude
				setStorage('coordinate',res.longitude+' '+res.latitude);
				if (res.errMsg == "getLocation:ok") {
					//获取坐标地址
					var postData = {
					  key: '',
					  location: res.longitude + ',' + res.latitude,
					  extensions: 'base',
					  batch: false
					};
					console.log(res);
					uni.request({
						url: 'https://restapi.amap.com/v3/geocode/regeo',
						method: 'post',
						data: postData,
						dataType: 'json',
						header: {
						'content-type': 'application/x-www-form-urlencoded'
						},
						success: function (res1) {
							globalData.cityName=res1.data.regeocode.addressComponent.city;
							resolve(true);
						}, fail: function (res1) {
							console.log("获取详情信息失败" + res1);
						}
					});
				}else{
					console.log(res);
					resolve(false);
				}
			},fail(res) {
				console.log(res);
				resolve(false);
			},
		})
    });
 };
// 上传文件
const upload=function(pathUrl,number) {
    return new Promise((resolve, reject) => {
		var uploadUrl = globalData.uploadUrl;
		if (pathUrl) {
			var imgurl = uploadUrl + pathUrl;
		}else{
			var imgurl = uploadUrl + '';
		}
		uni.chooseImage({
			count: number?number:1, //默认9
			success: function (res) {
				// console.log(JSON.stringify(res.tempFilePaths));
				uni.showLoading({
					title: '上传中...'
				});
				uni.uploadFile({
					url: res.tempFilePaths[0],
					name: 'fileName1',
					filePath: imgurl,
					success: (res1) => {
						resolve(res1.data);
						uni.hideLoading();
					}
				})
			}
		});
	});
}
// vuex设置
const store = new Vuex.Store({
	state : {
		school : false
	},
	mutations : {
		changeSchool : function(state){
			state.school = true;
		}
	}
});
export {  
	globalData,
	setStorage,  
	getStorage,
	PostData,  
	sendSMS,  
	payOrder,  
	setting,  
	GetLocation, 
	wxLogin,
	GetAuthorization,
	upload,
	store
}  
