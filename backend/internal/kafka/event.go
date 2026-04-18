package kafka

type Message struct {
	Topic     string
	Partition int32
	Offset    int64
}

type Error struct {
	Code int
	Msg  string
}
