# Fcc
跨iframe通信

``` js
fcc
    .on('evtName1', callback)
    .on('evtName2', callback)
    .off('evtName1')

// 广播
fcc.emit('evtName1', parm)

// 回调
fcc.call('evtName1', parm).then(val => val)

```
