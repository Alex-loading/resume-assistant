document.querySelector('form').addEventListener('submit', event => {
  event.preventDefault(); document.querySelector('#result').textContent='已完成本地检查，没有发送申请。';
});
