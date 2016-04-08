/**
 * 填工作量 app
 * @author Jo
 */
import React from 'react-native';
import Dimensions from 'Dimensions';
import Button from 'react-native-button';
import cheerio from 'cheerio';
import _ from 'lodash';
import dismissKeyboard from 'dismissKeyboard';
import Ntlm from './utils/ntlm.js';
import DeviceStorage from './utils/storage.js';

const {
    Component,
    StyleSheet,
    Text,
    TextInput,
    View,
    Alert
} = React;

const url = 'http://iems.shinetechchina.com/MyiEMS/taskes/mytaskes.aspx';
const domain = 'shinetechchina.com';
const hostname = "iems.shinetechchina.com";

class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            userName: '',
            passWord: '',
            textlist: []
        };
        this.fillTime = this.fillTime.bind(this);
    }
    
    componentDidMount() {
        DeviceStorage.get("credential").then((credential)=>{
            console.log(credential);
        })
    }
        
    async firstHandShake(userName, passWord) {
        Ntlm.setCredentials(domain, userName, passWord);
        let msg1 = Ntlm.createMessage1(hostname);
        this.showMessage('开始NTLM认证，第一次握手....')
        return await fetch(url, {
            method: 'GET',
            headers: {
                credentials: 'include',
                Authorization: 'NTLM ' + msg1.toBase64()
            }
        })
    }

    async secondHandShake(headers) {
        let wwwAuthCode = headers.map['www-authenticate'][0];
        this.showMessage('获取www-authenticate成功....')
        this.showMessage('生成challenge....')
        let challenge = Ntlm.getChallenge(wwwAuthCode);
        this.showMessage('生成challenge成功....')
        let msg3 = Ntlm.createMessage3(challenge, hostname);
        this.showMessage('提交认证信息....')
        return await fetch(url, {
            method: 'GET',
            headers: {
                credentials: 'include',
                Authorization: 'NTLM ' + msg3.toBase64()
            }
        })
    }

    async reportTime(secondResponse) {
        if (secondResponse.status == 200) {
            let html = await secondResponse.text();
            this.showMessage('认证通过，准备填入工作量....')
            let $ = cheerio.load(html);
            let inputs = $('form input');
            let data = {};
            _.forEach(inputs, function(t) {
                let attrValue = t.attribs.value;
                if (t.attribs.name && t.attribs.name.indexOf('txtHours') > 0) {
                    attrValue = 8
                }
                data[t.attribs.name] = attrValue;
            });

            let postData = Object.keys(data).map(function(keyName) {
                return encodeURIComponent(keyName) + '=' + encodeURIComponent(data[keyName])
            }).join('&');
            this.showMessage('开始填入....')
            return await fetch(url, {
                method: 'POST',
                headers: {
                    credentials: 'include',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: postData
            })
        } else if (secondResponse.status == 401) {
            this.showMessage('认证失败，用户名密码错误....')
        } else {
            this.showMessage('服务器异常，请稍后重试....')
        }
    }

    async fillTime() {
        try {
            dismissKeyboard();
            this.setState({ textlist: [] });
            // let userName = this.state.userName;
            // let passWord = this.state.passWord;
            let userName = 'zoul';
            let passWord = 'Shinetech2012';
            if (userName.length == 0 || passWord.length == 0) {
                this.showMessage('用户名,密码不能为空')
                return;
            }

            let firstResponse = await this.firstHandShake(userName, passWord);
            this.showMessage('第一次握手结束....')
            let secondResponse = await this.secondHandShake(firstResponse.headers);
            this.showMessage('已收到服务器响应....')
            let finalResponse = await this.reportTime(secondResponse);
            this.showMessage('填入结束....')
            DeviceStorage.save("credential",{userName:this.state.userName,passWord:this.state.passWord});
            let html = await finalResponse.text();
            var $ = cheerio.load(html);
            var msg = $('#ctl00_ContentPlaceHolderMain_rtPOs_ctl00_lerrorMessage').text();
            Alert.alert(
                '',
                msg,
                [
                    { text: 'OK', onPress: () => console.log('success') }
                ]
            )
        } catch (error) {
            Alert.alert(
                '',
                error.message,
                [
                    { text: 'OK', onPress: () => console.log('error') }
                ]
            )
        }
    }

    showMessage(msg) {
        if (msg) {
            var count = this.state.textlist.length;
            let msgElement = (
                <Text style={styles.baseText} key={count + 1}> {msg} </Text>
            );

            let msgList = this.state.textlist.concat([msgElement]);
            this.setState({ textlist: msgList })
        }
    }

    render() {
        return (
            <View style={styles.container}>
                <Text style={styles.signin}>
                    Shinetech
                </Text>
                <TextInput style={styles.textbox} ref='userName' placeholder='用户名' onChangeText={(text) => this.setState({ userName: text }) } value={this.state.userName} />
                <TextInput secureTextEntry={true} style={styles.textbox} ref='passWord' placeholder='密码' onChangeText={(text) => this.setState({ passWord: text }) } value={this.state.passWord} />
                <Button
                    containerStyle={{ padding: 10, height: 45, overflow: 'hidden', borderRadius: 4, backgroundColor: '#569e3d', marginTop: 10 }}
                    style={{ fontSize: 20, color: 'white', width: 80 }}
                    styleDisabled={{ color: 'red' }}
                    onPress={this.fillTime}>
                    填 入
                </Button>
                <View style={{ marginTop: 15 }}>
                    {this.state.textlist}
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        backgroundColor: '#F5FCFF',
    },
    signin: {
        textAlign: 'center',
        fontSize: 30,
        color: 'gray',
        marginTop: 60
    },
    textbox: {
        fontSize: 16,
        height: 50,
        color: 'rgb(46,52,54)',
        width: Dimensions.get('window').width - 40
    },
    baseText: {
        fontFamily: 'Cochin',
        fontSize: 16,
        color: '#ff8800'
    },

});

export default App;