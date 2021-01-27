export default class VirtualScroll {
  constructor($el, data, itemElGenerator, options = {}) {
    this.$el = $el; // 视口容器
    this.data = data; // 全部数据
    this._data = []; // 虚拟数据
    this.itemElGenerator = itemElGenerator; // Item生成器
    this._offset = 0;

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
    // 最大滚动量
    const contentSpace = this.contentHeight - this.containerHeight;
    // 当前滚动量
    let y = 0;
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
      console.log(this.offset)
    };

    let lastPostion = 0;
    const recordPostion = (e) => {
      const offset = extractPx(this.$scrollBar.style.transform)
      lastPostion = offset

      const noThrolttle = (e) => {
        const scrollSpace = this.$scrollTrack.clientHeight - this.$scrollBar.clientHeight
        lastPostion += e.movementY
        lastPostion = Math.max(lastPostion, 0)
        lastPostion = Math.min(lastPostion, scrollSpace)
      }
      const updatePostion = (e) => {
        const scrollSpace = this.$scrollTrack.clientHeight - this.$scrollBar.clientHeight
        const contentSpace = this.contentHeight - this.containerHeight
        const rate = lastPostion / scrollSpace

        const contentOffset = contentSpace * rate
        y = contentOffset

        this.offset = contentOffset
        this.$scrollBar.style.transform = `translateY(${lastPostion}px)`
      }
      const _updatePosition = throttle(updatePostion, 30)
      const removeEvent = () => {
        document.removeEventListener("mousemove", _updatePosition)
        document.removeEventListener("mousemove", noThrolttle)
        document.removeEventListener("mouseup", removeEvent)
      }

      document.addEventListener("mousemove", noThrolttle)
      document.addEventListener("mousemove", _updatePosition)
      document.addEventListener("mouseup", removeEvent)
    };


    // 阻止冒泡并记录滚动量
    this.$el.addEventListener('mousewheel', preventDefault);
    // 更新偏移量
    this.$el.addEventListener('mousewheel', throttle(updateOffset, 30));
    // 手动滚动
    this.$scrollBar.addEventListener("mousedown", recordPostion);


    // 销毁事件
    this.unbindEvent = () => {
      this.$scrollBar.removeEventListener("mousedown", recordPostion)
      this.$list.removeEventListener("mousewheel", _updateOffset)
      this.$list.removeEventListener("mousewheel", noThrolttle)
    }
  }

  // 渲染Item并更新滑块位置
  render(offset) {
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

    const startIndex = findOffsetIndex(this._data, offset);
    const endIndex = findOffsetIndex(this._data, offset + this.containerHeight)
    console.log(startIndex, endIndex)
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
