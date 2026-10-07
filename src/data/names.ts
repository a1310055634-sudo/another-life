// 第 44 轮：取名池——关键关系建立时由引擎 seed 确定具名，替代写死的静态名
// （孩子不再终生叫「宝宝」，搭伴对象不再人人是「老吴」）。
// 选取纯函数：同 seed 同 salt 同序数必得同名（存档可复现），不同局自然分散。
// 乳名池性别中立；伴侣名用两字/三字全名（玩家性别未建模，不带头衔称谓）。

/** 孩子乳名池（rel_child_question / 二胎等「宝宝」类关系） */
export const CHILD_NICKNAMES = ['小满', '念念', '团团', '安安', '果果', '多多', '整整', '初初']

/** 孙辈乳名池（fam_grandchild 等孙辈关系） */
export const GRANDCHILD_NICKNAMES = ['豆豆', '糖糖', '元宝', '汤圆', '满满', '小粽子']

/** 晚年搭伴伴侣名池（late_late_companion 升级的真实关系） */
export const COMPANION_NAMES = ['陶春', '路明', '沈一如', '何念', '程遥', '董晴川', '顾行舟', '白静漪']

/** 手足名池（第 64 轮兄弟姐妹，开局定数建立；称谓兄/姐/弟/妹由 birthAge 相对年龄派生，不入名） */
export const SIBLING_NAMES = ['建平', '秀英', '志刚', '桂兰', '永强', '丽娟', '卫华', '淑芬']

/** 朋友昵称池（第 66 轮挚友线：老×/阿×/小×/单字诨名风格；事件静态具名仍优先） */
export const FRIEND_NICKNAMES = ['老周', '老陈', '老白', '阿凯', '阿康', '小杜', '小北', '大鹏']

// 第 115 轮：同事/邻居取名池（关系网走出家门；同事用职场称谓风，邻居用楼里称谓风）
export const COLLEAGUE_NICKNAMES = ['老郑', '小蒋', '阿芳', '大刘', '老韩', '小夏', '阿斌', '丹丹']
export const NEIGHBOR_NICKNAMES = ['张婶', '李叔', '老孟', '小江', '蒋阿姨', '大勇', '林家', '桂香']

/**
 * 从池中 seed 确定地取一个名字：index 由 seed、salt（建立时玩家年龄）与
 * nonce（关系数组长度，多实例分散）共同决定。纯函数、无状态。
 */
export function pickName(pool: string[], seed: number, salt: number, nonce: number): string {
  const h =
    ((seed >>> 0) ^ (Math.imul(salt, 0x9e3779b1) >>> 0) ^ (Math.imul(nonce, 0x85ebca6b) >>> 0)) >>> 0
  return pool[h % pool.length]
}
