export default class VirtualScroll {
  constructor($el, data, itemElGenerator, options = {}) {
    this.$el = $el; // 视口容器
    this.$elInner = ''; // 内层容器
    this.data = data; // 全部数据
    this._data = []; // 虚拟数据
    this.itemElGenerator = itemElGenerator; // Item生成器
    this._offset = 0;
    this.cacheCount = options.cacheCount || 5; // 缓冲区, 前后可以先预渲染的Item数量
    this.readerCacheData = []; // 渲染的缓冲区数据 => 也就是已渲染出来的元素

    this.initItem(); // 初始虚拟数据
    this.initContainer(); // 初始化视口容器信息
    this.initScroll(); // 初始化滚动条

    this.binderEvent(); // 初始化监听者

    this.offset = this._offset; // 完成初次渲染
  }

  get offset() {
    return this._offset;
  }
  set offset(value) {
    this.render(value);
    return (this._offset = value); // 同步_offset的值
  }

  // 初始虚拟数据
  initItem() {
    this._data = this.data.map((item, index) => ({
      height: 40,
      original: item,
      index,
    }))
  }
  // 初始化视口容器信息
  initContainer() {
    this.$el.style.overflow = 'hidden';
    this.$el.style.position = 'relative';
    this.containerHeight = this.$el.clientHeight;
    this.contentHeight = calcItemSumHeight(this._data);
  }
  // 初始化滚动条
  initScroll() {
    const scrollTrack = document.createElement('div');
    const scrollBar = document.createElement('div');
    scrollTrack.classList.add('vs_scroll');
    scrollBar.classList.add('vs_scroll-bar');

    scrollTrack.appendChild(scrollBar);
    this.$el.appendChild(scrollTrack);
    this.$scrollTrack = scrollTrack;
    this.$scrollBar = scrollBar;
  }

  // 监听者
  binderEvent() {
    const contentSpace = this.contentHeight - this.containerHeight; // 最大滚动量
    let y = 0; // 当前滚动量

    // 阻止冒泡并记录滚动量
    const preventDefault = (e) => {
      e.preventDefault();
      y += e.deltaY; // deltaY: 每次滚动量
      y = Math.max(y, 0);
      y = Math.min(y, contentSpace);
    };
    // 更新偏移量
    const updateOffset = () => {
      if (y !== this.offset) {
        this.offset = y;
      }
    };
    // 手动滑动滑块
    let lastPostion = 0;
    const recordPostion = (e) => {
      let offset = extractPx(this.$scrollBar.style.transform);
      lastPostion = offset;

      let noThrolttle = (e) => {
        const scrollSpace = this.$scrollTrack.clientHeight - this.$scrollBar.clientHeight;
        lastPostion += e.movementY;
        lastPostion = Math.max(lastPostion, 0);
        lastPostion = Math.min(lastPostion, scrollSpace);
      };
      let updatePostion = (e) => {
        const scrollSpace = this.$scrollTrack.clientHeight - this.$scrollBar.clientHeight;
        const contentSpace = this.contentHeight - this.containerHeight;
        const rate = lastPostion / scrollSpace;

        const contentOffset = contentSpace * rate;
        y = contentOffset;

        this.offset = contentOffset;
        this.$scrollBar.style.transform = `translateY(${lastPostion}px)`;
      };
      let _updatePosition = throttle(updatePostion, 30)
      let removeEvent = () => {
        document.removeEventListener('mousemove', _updatePosition);
        document.removeEventListener('mousemove', noThrolttle);
        document.removeEventListener('mouseup', removeEvent);
      };

      // 鼠标移动
      document.addEventListener('mousemove', noThrolttle);
      document.addEventListener('mousemove', _updatePosition);
      // 鼠标抬起
      document.addEventListener('mouseup', removeEvent);
    };


    // 阻止冒泡并记录滚动量
    this.$el.addEventListener('mousewheel', preventDefault);
    // 更新偏移量
    this.$el.addEventListener('mousewheel', throttle(updateOffset, 30));
    // 手动点击
    this.$scrollBar.addEventListener('mousedown', recordPostion);


    // 销毁事件
    this.unbindEvent = () => {
      this.$scrollBar.removeEventListener('mousedown', recordPostion)
      this.$list.removeEventListener('mousewheel', throttle(updateOffset, 30))
      this.$list.removeEventListener('mousewheel', preventDefault)
    }
  }
  // 渲染Item并更新滑块位置
  render(offset) {
    console.log('偏移量：' + offset);
    // 更新滑块位置
    ((offset) => {
      const barHeight = this.$scrollBar.clientHeight; // 滑块位置
      const scrollSpace = this.containerHeight - barHeight;
      const contentSpace = this.contentHeight - this.containerHeight; // 最大滚动量

      let rate = offset / contentSpace; // 滑块占最大滚动量比例
      if (rate > 1) {
        rate = 1
      }
      const barOffset = scrollSpace * rate;
      this.$scrollBar.style.transform = `translateY(${barOffset}px)`
    })(offset);

    /**
     * 渲染Item分为两种情况：
     * 1. 因为存在缓冲区, 所以少量的滚动时, 可以直接就是偏移translateY就行了.
     * 2. 超过缓冲区的滚动操作就要重新渲染Item.
     */
    let startIndex = findOffsetIndex(this._data, offset);
    let endIndex = findOffsetIndex(this._data, offset + this.containerHeight);


    if(isExistCache(startIndex, endIndex, this.readerCacheData)) {
      console.log('缓冲区');
      let start = this.readerCacheData[0].index;
      let translateY = offset - calcItemSumHeight(this._data, 0, start);
      this.$elInner.style.transform = `translateY(-${translateY}px)`;
      return;
    }

    createDom.call(this);

    /**
     * 第二种情况需要重新渲染新Item
     */
    function createDom() {
      let startIndexCache = Math.max(startIndex - this.cacheCount, 0); // 该索引只有超过了缓冲量(cacheCount)才有变化, 不超过就一直取最小的0索引
      let endIndexCache = Math.min(endIndex + this.cacheCount, this._data.length);
      let translateY = offset - calcItemSumHeight(this._data, 0, startIndexCache);
      this.readerCacheData = this._data.slice(startIndexCache, endIndexCache);


      // 创建内层容器
      if (!this.$elInner) {
        let elInnerVirtual = document.createElement('div');
        elInnerVirtual.classList.add('vs_scroll-inner');
        this.$el.appendChild(elInnerVirtual);
        this.$elInner = elInnerVirtual;
      }

      // 创建虚拟的节点对象
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < this.readerCacheData.length; i++) {
        let item = this.readerCacheData[i];
        let $item = this.itemElGenerator(item);

        if ($item && $item.nodeType === 1) { // 1: 元素节点; 2: 属性节点
          fragment.appendChild($item)
        }
      }

      // 挂载节点
      this.$elInner.innerHTML = '';
      this.$elInner.appendChild(fragment);
      // 实际我们在界面上没有并没有滚动, 所以对于溢出去的元素我们需要偏移translateY才能看到
      this.$elInner.style.transform = `translateY(-${translateY}px)`;
    }


    /**
     * 判断是否在缓冲区
     * @param startIndex
     * @param endIndex
     * @param readerCacheData
     * @tip 开始索引与结束索引这段数据是否在一个数组中, 只要判断开始索引是否大于数组的最小索引且小于数组的最大索引, 结束索引同理
     */
    function isExistCache(startIndex, endIndex, readerCacheData) {
      if (!readerCacheData.length) return;
      let start = readerCacheData[0].index;
      let end = readerCacheData[readerCacheData.length - 1].index;
      let existFn = (num, min, max) => num >= min && num <= max;

      return existFn(startIndex, start, end) && existFn(endIndex, start, end);
    }
  }
  // 销毁监听者
  destory() {
    this.unbindEvent()
  }
}

/**
 * 一定偏移量内相关的Item是否在这个范围内
 * @param list
 * @param offset
 * @returns {number}
 */
function findOffsetIndex(data = [], offset) {
  let currentHeight = 0;
  for (let i = 0; i < data.length; i++) {
    const { height } = data[i];
    currentHeight += height;

    if (currentHeight > offset) {
      return i;
    }
  }
  return data.length - 1;
}

/**
 * 计算一定数量的Item总高度
 * @param list
 * @param start
 * @param end
 * @returns {number}
 */
function calcItemSumHeight(list, start = 0, end = list.length) {
  let height = 0
  for (let i = start; i < end; i++) {
    height += list[i].height
  }

  return height
}

/**
 * 节流
 * @param fn
 * @param wait
 * @returns {Function}
 */
function throttle(fn, wait) {
  let timer, lastApply

  return function (...args) {
    const now = Date.now();
    if (!lastApply) {
      fn.apply(this, args);
      lastApply = now;
      return
    }

    if (timer) return;
    const remain = now - lastApply > wait ? 0 : wait;

    timer = setTimeout(() => {
      fn.apply(this, args);
      lastApply = Date.now();
      timer = null
    }, remain)
  }
}

/**
 * 100px => 100
 * @param string
 * @returns {number}
 */
function extractPx(string) {
  const r = string.match(/[\d|.]+(?=px)/)
  return r ? Number(r[0]) : 0
}
