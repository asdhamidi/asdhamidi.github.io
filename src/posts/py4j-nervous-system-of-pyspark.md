---
title: "Py4J: The Nervous System of PySpark"
date: "2026-10-03"
slug: "py4j-nervous-system-of-pyspark"
description: "Follow one PySpark script from the first line to the last result, in seven stages, and see what actually crosses the Py4J wire at each one."
---

# Py4J: The Nervous System of PySpark
![Py4J: The Nervous System of PySpark](/py4j-poster.png)

_Follow one PySpark script from the first line to the last result, and see what actually crosses the Py4J wire at each stage._

---

## TL;DR
PySpark isn't Spark rewritten in Python. It is a Python process remote-controlling a JVM through Py4J. This post follows one script through seven stages, from "start a JVM" to "get the rows back," and shows what crosses the wire at each one. The short version: Py4J carries short instructions and small tickets, never bulk data. It's the nervous system, not the bloodstream.

## The mystery

Picture this: you run the following against a 2 TB table.

```python
big = df.filter(df.amount > 100)
```

It returns in milliseconds. Nothing was read and no executor woke up. Yet `big` is a perfectly valid DataFrame, and `.show()` later does the right thing.

So where did the work go? And where does the *knowledge* of what to do live, if your Python process isn't holding the data?

Here's the answer in one picture. Your script and Spark are two different programs. Python is a customer on the phone. The JVM is the kitchen. Py4J is the phone line. This post is the story of how that line gets set up and what gets said on it.

One script runs through the whole story:

```python
spark = SparkSession.builder.appName("demo").getOrCreate()           # (1)
df  = spark.read.csv("sales.csv", header=True, inferSchema=True)     # (2)
big = df.filter(df.amount > 100)                                     # (3)
agg = big.groupBy("region").sum("amount")                            # (4)
agg.show()                                                           # (5)
rows = agg.collect()                                                 # (6)
```

> **About the output in this post.** Every log, ID and count was captured by running real code on PySpark 4.2.0 with Py4J 0.10.9.9, Java 21 and `local[1]`. IDs and timings will differ on your machine, so rerun the snippets before trusting a number.

## The cast

**Python process**

- Your script
- `SparkSession` (a proxy)
- `DataFrame` (a proxy)

**↕ Py4J socket on `127.0.0.1`**: short text commands go one way, replies and tickets come back.

**Driver JVM**

- Py4J server
- `SparkContext` (the real one)
- Catalyst, the scheduler and the Spark UI

Everything you think of as "Spark" lives in the JVM. Everything in the Python process is a thin layer holding *references* to things in the JVM. Keep that word in mind.

Py4J lets Python call Java objects living in a separate JVM, and lets Java call back into Python. It is **not JNI**. The two sides are separate OS processes that talk over a local TCP socket using a small text protocol. That buys isolation (a JVM crash can't segfault your interpreter) and costs serialization and latency on every call. And one limitation shapes everything that follows: **Py4J carries instructions, not bulk data.**

## The seven stages

1. **Wake the JVM**: Python starts a second process.
2. **Swap the phone number**: how Python learns where to call.
3. **Open the line**: the server and the connection.
4. **Learn the language**: how names and tickets work.
5. **Place the first order**: creating Spark itself.
6. **Place a real order**: one `filter`, in slow motion.
7. **Collect the delivery**: where data actually travels.

Each stage ends with a short "Where we are," so you can always tell how far along the story you are.

---

## Stage 1: Wake the JVM

**Stage 1 of 7.** Before there's any phone line, someone has to build the kitchen. In a plain script, that someone is your own code. `getOrCreate()` starts a chain that ends in a function called `launch_gateway`:

<<<<<<< HEAD
```
getOrCreate()  ->  SparkContext.__init__  ->  _ensure_initialized()  ->  launch_gateway()
```

Nothing launches at `import pyspark`. The JVM starts at the first call that actually needs it. And `launch_gateway` starts it with a plain `Popen`, straight from the 4.2.0 source:
=======
**Python process**

- Your script
- `SparkSession` (a proxy)
- `DataFrame` (a proxy)

**↕ Py4J socket on `127.0.0.1`**: short text commands go one way, replies and tickets come back.

**Driver JVM**

- Py4J server
- `SparkContext` (the real one)
- Catalyst, the scheduler and the Spark UI

Everything you think of as "Spark" lives in the JVM. Everything in the Python process is a thin layer holding *references* to things in the JVM. Keep that word in mind.

Py4J lets Python call Java objects living in a separate JVM, and lets Java call back into Python. It is **not JNI**. The two sides are separate OS processes that talk over a local TCP socket using a small text protocol. That buys isolation (a JVM crash can't segfault your interpreter) and costs serialization and latency on every call. And one limitation shapes everything that follows: **Py4J carries instructions, not bulk data.**

## Two ways to start PySpark

Before the bridge exists, one process has to start the other. There are two routes.

| | Python-first | JVM-first |
|---|---|---|
| How you run it | `python app.py`, notebooks, the `pyspark` shell | `spark-submit app.py` |
| Who starts first | Python | the JVM |
| Who launches the other | `launch_gateway()` runs `spark-submit pyspark-shell` | `PythonRunner` launches Python as a child |
| How Python learns port and secret | a connection file written by the JVM | environment variables |
| Handshake file and stdin pipe | yes | no |

`spark-submit app.py` is the usual production route: it sets driver and executor options before the JVM starts and handles cluster modes. `SparkSubmit` sees a `.py` file and makes `PythonRunner` the main class, which (simplified):

```scala
val gatewayServer = new Py4JServer(sparkConf)
// started on a thread named "py4j-gateway-init"; wait for it so the port is known

env.put("PYSPARK_GATEWAY_PORT", "" + gatewayServer.getListeningPort)
env.put("PYSPARK_GATEWAY_SECRET", gatewayServer.secret)

// launch `python app.py` as a child, forward its output, wait for it to exit,
// then shut the gateway down
```

On the Python side, `launch_gateway` begins by checking whether someone already did all that:
>>>>>>> refs/remotes/origin/main

```python
popen_kwargs["stdin"] = PIPE
proc = Popen(command, **popen_kwargs)
```

The command is the `spark-submit` script with `pyspark-shell` as its target, plus any config you set. On Linux that script replaces itself with `java`, so the `Popen` handle's PID is the JVM's PID.

The `stdin=PIPE` is the interesting part.

> **Note: `Popen` and the stdin pipe.** `Popen` starts another program as a separate process and returns immediately. `stdin=PIPE` gives Python the writing end of a pipe whose reading end is the JVM's `System.in`. **Python never writes to it.** While Python is alive, the JVM sits blocked on a read. When Python dies, even from `kill -9`, the OS closes the pipe, the read returns `-1`, and the JVM exits. It's a dead-man's switch, and I confirmed it live: after `kill -9` on the Python process, the JVM was gone within three seconds. The pipe carries nothing. All real traffic goes over the Py4J socket.

### The other way in

Everything here follows the Python-first route (`python app.py`, notebooks and the `pyspark` shell). The common production route is `spark-submit app.py`, which reverses the order:

| | Python-first | `spark-submit app.py` |
|---|---|---|
| Who starts first | Python | the JVM |
| Who launches the other | `launch_gateway()` | `PythonRunner`, as a child process |
| How Python learns the port | a file the JVM writes | environment variables |

In the second route, `PythonRunner` starts the Py4J server itself and puts the port and secret into `PYSPARK_GATEWAY_PORT` and `PYSPARK_GATEWAY_SECRET` before launching Python. `launch_gateway` begins by checking for those variables and, if they're set, skips straight to connecting. Both routes end in the same place, so I follow the first one because it shows every moving part.

**Where we are:** a JVM is booting and Python is waiting. But the JVM will listen on a random port, and Python doesn't know which one.

## Stage 2: Swap the phone number

**Stage 2 of 7.** The JVM asks the OS for any free port, so nobody knows the number in advance. Python can't guess it, and the JVM's stdout is already full of Spark logs. So they hand off through a file.

Python reserves a unique path and passes it to the JVM in an environment variable:

```python
conn_info_dir = tempfile.mkdtemp()
fd, conn_info_file = tempfile.mkstemp(dir=conn_info_dir)
os.close(fd)
os.unlink(conn_info_file)                       # we only wanted a unique path
env["_PYSPARK_DRIVER_CONN_INFO_PATH"] = conn_info_file
```

The JVM, once its server is up, writes the port and a secret into that file:

```scala
dos.writeInt(boundPort)
dos.writeInt(secretBytes.length)
dos.write(secretBytes, 0, secretBytes.length)
tmpPath.renameTo(connectionInfoPath)            // atomic publish
```

Python polls until the file appears, then reads it:

```python
with open(conn_info_file, "rb") as info:
    gateway_port = read_int(info)
    gateway_secret = UTF8Deserializer().loads(info)
```

> **Note: the connection file, in order.** (1) Python reserves a unique file path; the file doesn't exist yet. (2) It passes the path to the JVM and starts it. (3) The JVM opens a server on a random free port and generates a random secret. (4) It writes both to a temp file, then **renames** it into place, so Python never reads a half-written file. (5) Python, polling, sees the file and reads the port and secret. (6) A `finally` block deletes the whole temp folder, so the secret doesn't sit on disk.

If the JVM dies before the file appears, Python gives up with `[JAVA_GATEWAY_EXITED] Java gateway process exited before sending its port number.` We'll come back to that one.

**Where we are:** Python holds a port and a secret, in memory only. The file is gone.

## Stage 3: Open the line

**Stage 3 of 7.** On the JVM side, the server comes from a small class, `Py4JServer`. The part that matters is three settings:

```scala
new py4j.ClientServer.ClientServerBuilder()
  .authToken(secret)          // every connection must present this
  .javaPort(0)                // let the OS pick a free port
  .javaAddress(localhost)     // loopback only
  .build()
```

Each one is a decision:

- **`javaPort(0)`** is *why* Stage 2 needed a file at all.
- **Loopback only** means nothing off the machine can connect. On a live run, the Py4J server showed up listening on `127.0.0.1` with a random port.
- **`authToken`** means no secret, no session. It stops another program on a shared machine from hijacking your driver.

(The default is `ClientServer`, which pins each Python thread to one JVM thread. That keeps JVM thread-local state, like local properties, from leaking between PySpark threads.)

Meanwhile the JVM's main thread does nothing except wait on that stdin pipe from Stage 1. Py4J's own threads do the real work.

Python then dials in with the port and secret it read:

```python
gateway = ClientServer(
    java_parameters=JavaParameters(port=gateway_port,
                                   auth_token=gateway_secret,
                                   auto_convert=True),
    python_parameters=PythonParameters(port=0, eager_load=False))
gateway.proc = proc
```

`auto_convert=True` quietly turns Python lists and dicts into Java collections when you pass them as arguments. `gateway.proc` keeps the `Popen` handle so PySpark can kill the JVM later.

**Where we are:** the line is open and authenticated, and nothing has been said on it. The kitchen is built and the lights are on, but there's no Spark in it yet. This is the **driver JVM**, and it lives for the whole program.

## Stage 4: Learn the language

**Stage 4 of 7.** Python now has `gateway.jvm`, and it's easy to misread. It is **not the JVM**. It's a small Python object that holds no Java classes at all. Every attribute access on it becomes a question for the JVM.

Python evaluates `jvm.java.util.ArrayList()` one dot at a time, and at each dot it has no idea whether the name is a package, a class or a typo. So it asks. This is the real traffic for that one expression (each command is sent as separate lines; I've joined them with `/` for readability):

| Python writes | Sent over the wire | Reply |
|---|---|---|
| `jvm.java` | `r / u / java / rj / e` | `!yp` (a package) |
| `.util` | `r / u / java.util / rj / e` | `!yp` (a package) |
| `.ArrayList` | `r / u / java.util.ArrayList / rj / e` | `!ycjava.util.ArrayList` (a class) |
| `ArrayList()` | `i / java.util.ArrayList / e` | `!ylo30` (a list, ticket `o30`) |

The first three are reflection lookups (`r`, then `u` for "get unknown"). The fourth is a constructor (`i`), and it returns a **ticket**: `o30`.

That's how Py4J reaches any class on the JVM's classpath with zero setup. It doesn't need to know in advance, it asks. It also isn't free: on my sandbox VM, a cached call took about 70 microseconds, while walking the whole dotted path each time took about 1.2 milliseconds. Your numbers will differ, but the ratio is the lesson.

To skip the long walks, PySpark registers imports right after connecting:

```python
java_import(gateway.jvm, "org.apache.spark.SparkConf")
java_import(gateway.jvm, "org.apache.spark.api.java.*")
java_import(gateway.jvm, "org.apache.spark.api.python.*")
# ...plus about a dozen more
```

After that, `gateway.jvm.SparkConf` works with a short name.

Now the most important idea in the whole post:

> **Note: what "reference" means.** A reference is a label pointing to an object that lives somewhere else. A copy hands someone the whole thing; a reference hands them a ticket number while the real thing stays put. When Python creates a Java object, the object lives in the JVM, which keeps a table such as `"o30" → ArrayList`. Python holds only the string `"o30"`. The pieces along a dotted chain (`java`, `util`, `ArrayList`) hold only **names**. Only a finished object holds a ticket. The JVM owns every real object; Python holds names and tickets.

**Where we are:** Python can name anything in the JVM and receive tickets for what it creates. It still hasn't ordered anything real.

## Stage 5: Place the first order

**Stage 5 of 7.** The first real order is "build me a `SparkContext`," and it's one line in `SparkContext._do_init`:

```python
self._jsc = self._jvm.JavaSparkContext(jconf)
```

Here's what it does, in order:

1. **Python looks up the class.** The short name works thanks to the `java_import` from Stage 4.
2. **Python sends a "construct this" command.** The argument, `jconf`, is not your settings. It's a *ticket* for a Java `SparkConf` that already lives in the JVM. Your settings are never re-sent.
3. **The JVM runs the real constructor.** This is the heavy step: scheduler, memory manager, Spark UI, the link to the cluster manager. Python sits blocked, waiting. That wait is your few seconds of startup.
4. **The JVM stores the finished object and replies with a new ticket.**
5. **Python keeps it as `self._jsc`.**

Right after, Python makes a handful of small calls to read settings back (the final config, whether encryption is on, a buffer size). The `SparkSession` is built on top of this context the same way.

If the constructor fails, the error reads `None.org.apache.spark.api.java.JavaSparkContext`. The `None` is there because a constructor has no existing object to call a method on.

**Where we are:** Spark is alive. Here's who holds what:

| In the Python process | In the JVM |
|---|---|
| `_jsc`, a ticket | the real `JavaSparkContext` |
| `_jsparkSession`, a ticket | the real `SparkSession` |
| a Python `SparkConf` | the matching Java `SparkConf` |

The startup is over. From here on, every line of your script is just orders over this line.

## Stage 6: Place a real order

**Stage 6 of 7.** Now the script itself. Almost every DataFrame transformation makes the same three moves:

1. Call a method on a JVM object, passing tickets as arguments.
2. Get a new ticket back.
3. Wrap that ticket in a new Python object.

In code, `filter` is essentially this (simplified):

```python
def filter(self, condition):
    jdf = self._jdf.filter(condition._jc)       # moves 1 and 2
    return DataFrame(jdf, self.sparkSession)    # move 3
```

### One call, in slow motion

Take line (3), and say `df` is ticket `o36` and the condition is ticket `o42`. These are the real IDs from a captured run. Python sends five lines:

| Line sent | Meaning |
|---|---|
| `c` | call a method |
| `o36` | on this object (`df`) |
| `filter` | this method |
| `ro42` | argument: `r` means reference, `o42` is the condition's ticket |
| `e` | end of command |

No DataFrame and no Column travels. Only their names do. The JVM replies with one line, `!yro43`:

| Part | Meaning |
|---|---|
| `!` | an answer starts |
| `y` | success |
| `r` | the value is a reference to an object |
| `o43` | the new ticket |

Python wraps `o43` in a `DataFrame`, and `big._jdf` is now that ticket. Strings and numbers come back by value instead (`!yi1`, `!ys...`), and only objects come back as tickets.

> **Note: where the ticket becomes an object.** The JVM's `Gateway` keeps a `bindings` map (thread-safe) from ID string to real Java object. Two methods work as a pair. `Protocol.getReference("ro42")` strips the type letter and looks the ID up, and it runs when the JVM **receives** a command. `Gateway.putNewObject(obj)` stores an object under a fresh ID, and it runs when the JVM **sends** a reply. Java reflection only ever sees real objects, so IDs exist only on the wire and in this table. When a Python proxy is garbage-collected, Py4J releases its entry with the memory command (`m`).

### Why nothing runs yet

So the JVM got a call, built a new object and returned a ticket. How does `show()` later know all the steps, when it receives only the latest ticket?

Because the JVM wasn't idle. It was **building a plan**. Every JVM DataFrame holds a small tree describing how to compute it, and each transformation makes a *new* object whose tree wraps the old one. By line (4), the newest ticket points at this:

- **Aggregate**: `sum(amount)` by `region`
  - **Filter**: `amount > 100`
    - **Relation**: `sales.csv`

The newest ticket holds the whole recipe. That's why an action only has to name one ID.

> **Note: how the plan reaches the JVM.** Python never sends a DAG. It sends small method calls with IDs, and the JVM builds the plan itself, one wrapped node per call. Nothing executes until an action. Old IDs keep working, since DataFrames are immutable. One exception to the laziness: Spark checks column names as it builds each node, so `df.filter("amuont > 100")` fails immediately with an `AnalysisException`. Run `agg.explain(True)` to see the tree your calls built.

### The action

Line (5), `show()`, is where work finally happens. One call does it:

```
c / o58 / showString / i20 / i20 / bFalse / e      ->      !ys+------+-----------+ ...
```

The JVM optimizes the plan, runs tasks on executors, formats a text table and sends it back as a string. A few hundred bytes cross the wire. If the table had billions of rows, none of them would.

### A word on cost

Counting round trips on 4.2.0: the `filter` is **1** call. But `df.amount` is 3, `col > 100` is 17, and `groupBy(...).sum(...)` is 15. Of the 17 calls for `>`, only one is the real operation. The other 16 are bookkeeping: in pinned-thread mode, PySpark records where in your code each column operation was written, so error messages can point at your line. The lesson: count round trips, not lines of Python. Building columns in a big loop costs more than it looks.

**Where we are:** the whole script is an exchange of short messages and tickets, and nothing has touched real data except the CSV scan in the JVM. One line left: `collect()`.

## Stage 7: Collect the delivery

**Stage 7 of 7.** Line (6) is the surprising one, because the reply to `collectToPython` is **not your rows**. It's an address.

Here's the real exchange:

| Python asks | Reply | Meaning |
|---|---|---|
| `collectToPython` on `o43` | `!yto44` | a ticket for an array |
| the array's length | `!yi3` | three items |
| item 0 | `!yi42597` | a port number |
| item 1 | `!ys2908...` | a secret |

The JVM has opened a **one-shot server** on a random port with a secret, and Python reads the address out of the array. Then Python connects to it directly:

```python
port = sock_info[0]
auth_secret = sock_info[1]
sockfile, sock = local_connect_and_auth(port, auth_secret)
sock.settimeout(None)       # materializing can take unpredictably long
```

The rows stream over that socket as batches of pickled data.

> **Note: the port number thing.** For `collect`, the Py4J reply carries an *address*, not the rows. The JVM opens a one-shot local socket server on a random port with a secret and returns the port and secret. Python connects to that port directly and reads the rows as a raw binary stream. It's the same pattern as Stage 2: the JVM picks the port and tells Python.

Why not stream rows through Py4J? Because it's a text, request-response protocol built for small messages. Two consequences follow:

- **The whole result passes through the driver JVM's memory.** A huge `collect()` kills the *driver*.
- **The socket can time out.** SPARK-21551 and SPARK-33143 are real tickets about exactly this.

`toPandas()` follows the same shape, with Arrow batches instead of pickled rows.

### The other roads

> **Note: all the channels.**
>
> | Channel | Carries | Between |
> |---|---|---|
> | Handshake file | port and secret, once | JVM to Python |
> | stdin pipe | nothing, only "Python died" | Python to JVM |
> | **Py4J socket** | commands, IDs, small values | driver Python and driver JVM |
> | One-shot socket | `collect` and `toPandas` results | driver JVM to driver Python |
> | Task serialization | the pickled UDF | driver JVM to executors |
> | Worker socket | UDF and RDD data | executor JVM and Python worker |

Py4J is the **control plane**. Everything else is the **data plane**.

UDFs deserve a mention, because people associate them with Py4J, and it's where Py4J is least involved. When you define a UDF, PySpark pickles it and tells the JVM through one constructor call. At runtime it travels to executors in Spark's normal task serialization, and the executor JVM starts Python workers itself. On my `local[1]` run, there was no `pyspark.daemon` process before the first UDF. After it, one appeared under the JVM, with a worker forked from it. The `daemon.py` and `worker.py` scripts contain no reference to Py4J at all. I haven't traced a real multi-node cluster, so treat "executors don't use Py4J" as confirmed for the worker code and inferred for the rest.

**Where we are:** the story is complete. Python gave orders, the JVM built a plan and ran it, and the rows arrived on a road of their own.

---

## Where it's heading: Spark Connect

Everything above is classic PySpark. Spark Connect, introduced in 3.4, replaces Py4J with a gRPC client-server design. The client builds an unresolved plan, sends it with protocol buffers, and gets results back as Arrow batches. The PySpark Connect client does not use Py4J, so `_jdf`, `_jsc` and `spark._jvm` don't exist there.

| | Classic (Py4J) | Spark Connect |
|---|---|---|
| Where the plan lives | in the JVM, one object per step | in the client, sent when you act |
| What Python sends | method calls naming tickets | a serialized plan |
| Process layout | same machine | client can be remote |

The default mode depends on your Spark version and platform, and I haven't verified it for every release, so check the docs for yours. Meanwhile, everything in this post is how PySpark has worked for most of its history.

## Why Py4J is the nervous system

Ask most people where Py4J shows up and you'll hear "UDFs." Now look at what you just walked through:

| Moment | Py4J's role |
|---|---|
| Startup | the connection, the secret, the imports |
| Creating the context | the `JavaSparkContext` constructor |
| Every transformation | a method call with tickets, a new ticket back |
| Every column expression | up to 17 round trips for one `>` |
| Actions | `showString`, `collectToPython` |
| Getting results | the port and secret for the data socket |
| UDFs | the pickled function, as one constructor argument |
| Errors | Java exceptions as `Py4JJavaError` |

UDFs are, if anything, where it's least involved at runtime.

So I don't think "bridge" is the right word. A bridge sits between two places, and you can walk around it. A nervous system carries signals (do this, stop that, here's what I sensed), while the heavy cargo goes through the bloodstream. Py4J tells the JVM what to build, what to run and where to send the results. The data takes other roads.

One honest caveat: "every step" means every **driver-side** step. Py4J lives on the driver. That isn't a hole in the metaphor, it is the metaphor, because the signals originate there. Take Py4J away and PySpark isn't slower, it's inert: no JVM, no context, nothing to attach a transformation to.

## Closing

Next time `df.filter(...)` returns instantly, you'll know what happened. Python sent five short lines to a local socket, the JVM looked up two tickets, wrapped a plan node, and replied with a new ticket. The real work hasn't started, and when it does, almost none of it will touch Py4J again. That's the design: a thin, constant signaling layer on the driver, with the heavy lifting somewhere else. Once you can see the signals, PySpark stops being a black box.
