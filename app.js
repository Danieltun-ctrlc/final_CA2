// server.js

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
app.use(express.static('public'));

app.use(bodyParser.urlencoded({ extended: true }));


const connection = mysql.createConnection({
    host: 'kwbnqa.h.filess.io',
    user: 'CA2event_wirerainas',
    password: 'af2985973478d60ccec642ea6bb6b29f2dfdff85',
    database: 'CA2event_wirerainas',
    port: 61002,                        
})

app.use(session({
  secret: '123secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7  
  }
}));

app.use(flash());


app.use((req, res, next) => {
  res.locals.error = req.flash('error');

  res.locals.success = req.flash("success");
  res.locals.emailexist = req.flash("emaile");
  if (res.locals.error === undefined) {
      console.log("myVar is strictly undefined");
    }

    if (res.locals.error === null) {
      console.log("anotherVar is strictly null");
    }

    if (res.locals.error !== undefined && res.locals.error !== null) {
      console.log("thirdVar is neither undefined nor null");
      
    }

  next();
});

app.use(bodyParser.json());

app.get('/', (req, res) => {
  console.log(req.session.user)
  if (req.session.user) {
    res.redirect("/dashboard");
  } else {
    res.render("home.ejs");
  }
  

});

app.get("/add", (req,res) => {
  if (req.session.user) {
    let email = req.session.user.email;
    res.render('add.ejs', { email});
  } else {
    res.redirect("/")
  }
})

app.post("/add", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/");
    }
    let emailone = req.session.user.email;
    const {
        event_name,
        type,
        subject,
        event_description,
        location,
        date,
        time,
        prioritisation,
        email
    } = req.body;

    
    if (!event_name || !type || !subject) {
        return res.render('add', {
            email: req.session.user.email,
            error: 'Please fill in all required fields.',
            success: ''
        });
    }

    const sql = `INSERT INTO event (event_name, type, subject, event_description, location, date, time, prioritisation, email) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        event_name.trim(),
        type,
        subject.trim(),
        event_description ? event_description.trim() : null,
        location ? location.trim() : null,
        date || null,
        time || null,
        prioritisation,
        email
    ];

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.render('add-event.ejs', {
                email: req.session.user.email,
                error: 'Failed to create event. Please try again.',
                success: ''
            });
        }

       
        res.redirect('/dashboard');
    });
});




app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const email = req.session.user.email;

  
  if (req.session.searchResult) {
    console.log("nice")
    const { events, searchTerm, priorityFilter, totalResults, searchPerformed } = req.session.searchResult;

    
    delete req.session.searchResult;

    return res.render("dashboard.ejs", {
      events,
      email,
      searchTerm,
      priorityFilter,
      totalResults,
      searchPerformed
    });
  }

  
  const sql = "SELECT * FROM event WHERE email = ? ORDER BY date DESC, time DESC";

  connection.query(sql, [email], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).send("Internal Server Error");
    }

    res.render("dashboard.ejs", {
      events: results,
      email,
      searchTerm: '',
      priorityFilter: 'all',
      totalResults: results.length,
      searchPerformed: false
    });
  });
});



function validateSignup(req, res, next) {
  const { username, email, password, role } = req.body;
  const errors = [];

 
  if (!username || !email || !password || !role) {
    errors.push("All fields are required.");
  }


  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push("Invalid email format.");
  }

  
  if (password.length < 6) {
    errors.push("Password must be at least 6 characters.");
  }

 
  const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
  if (!complexityRegex.test(password)) {
    errors.push("Password must contain at least 1 uppercase, 1 lowercase, and 1 number.");
  }

  
  if (!['user', 'admin'].includes(role)) {
    errors.push("Invalid role selected.");
  }

 
  if (errors.length > 0) {
    req.flash('error', errors);
    return res.redirect('/signup');
  }

  next();
}



app.post("/signup", validateSignup, async (req, res) => {
  const { username, email, password, role } = req.body;

  try {
    
    const hashedPassword = await bcrypt.hash(password, 10);

    
    const sql = "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)";
    const values = [username, email, hashedPassword, role];

    connection.query(sql, values, (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          req.flash('emaile', true);
          return res.redirect('/signup');
        }
        console.error(err);
        req.flash('error', 'Database error.');
        return res.redirect('/signup');
      }

      
      
      req.flash('success', 'Signup successful!');
      req.flash("user", username)
      res.redirect('/login');
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong.');
    res.redirect('/signup');
  }
});


app.get("/login", (req,res) => {
    res.render("login.ejs");
})

app.get("/signup", (req,res) => {
    res.render("signin.ejs")
})



app.post("/login", async(req, res) => {
  const { email, password } = req.body;

  
  const sql = "SELECT * FROM users WHERE email = ?";
  connection.query(sql, [email], async (err, results) => {
    if (err) {
      console.error(err);
      req.flash("error", "Something went wrong");
      return res.redirect("/login");
    }

    if (results.length === 0) {
      req.flash("error", "Invalid email or password");
      return res.redirect("/login");
    }

    const user = results[0];

    
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      req.flash("error", "Invalid email or password");
      return res.redirect("/login");
    }
     req.session.user = {
      email: user.email,
      role: user.role,
      username: user.username 
    };

    req.flash("success", "Welcome back!");

    
    if (user.role === "admin") {
      return res.redirect("/users");
    } else {
      return res.redirect("/dashboard");
    }
  });
});

app.post("/search-events", (req, res) => {
  console.log("yes this triggerd")
    if (!req.session.user) {
        return res.redirect("/");
    }
    
    let email = req.session.user.email;
    const { searchInput, priorityFilter } = req.body;
    
  
    let sql = 'SELECT * FROM event WHERE email = ?';
    let queryParams = [email];
    
  
    if (searchInput && searchInput.trim()) {
        sql += ' AND (event_name LIKE ? OR type LIKE ? OR subject LIKE ? OR location LIKE ? OR event_description LIKE ?)';
        const searchPattern = `%${searchInput.trim()}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    if (priorityFilter && priorityFilter !== 'all') {
      console.log(priorityFilter)
        sql += ' AND prioritisation = ?';
        queryParams.push(priorityFilter);
    }
    
  
    sql += ' ORDER BY date DESC, time DESC';
    
    connection.query(sql, queryParams, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        req.session.searchResult = {
    events: results,
    email: email,
    searchTerm: searchInput || '',
    priorityFilter: priorityFilter || 'all',
    totalResults: results.length,
    searchPerformed: true
};

res.redirect("/dashboard");
    });
});
app.get("/edit-event/:id", (req, res) => {
  const eventId = req.params.id;
  const email = req.session.user?.email;

  if (!email) return res.redirect("/login");

  const sql = "SELECT * FROM event WHERE id = ? AND email = ?";
  connection.query(sql, [eventId, email], (err, results) => {
    if (err || results.length === 0) {
      console.error(err);
      req.flash("error", "Event not found or unauthorized.");
      return res.redirect("/dashboard");
    }

    res.render("edit.ejs", {
      event: results[0],
      email
    });
  });
});
app.post("/edit-event/:id", (req, res) => {
  const eventId = req.params.id;
  const email = req.session.user?.email;

  const {
    event_name,
    type,
    subject,
    event_description,
    location,
    date,
    time,
    prioritisation
  } = req.body;

  const sql = `
    UPDATE event 
    SET event_name = ?, type = ?, subject = ?, event_description = ?, 
        location = ?, date = ?, time = ?, prioritisation = ?
    WHERE id = ? AND email = ?
  `;

  const values = [
    event_name,
    type,
    subject,
    event_description,
    location,
    date,
    time,
    prioritisation,
    eventId,
    email
  ];

  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error(err);
      req.flash("error", "Failed to update event.");
      return res.redirect("/dashboard");
    }

    req.flash("success", "Event updated successfully.");
    res.redirect("/dashboard");
  });
});

app.post("/delete-event/:id", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const eventId = req.params.id;
    const userEmail = req.session.user.email;

    const sql = "DELETE FROM event WHERE id = ? AND email = ?";
    connection.query(sql, [eventId, userEmail], (err, result) => {
        if (err) {
            console.error("Delete error:", err);
            req.flash("error", "Failed to delete the event.");
            return res.redirect("/dashboard");
        }

        if (result.affectedRows === 0) {
            req.flash("error", "Event not found or unauthorized.");
        } else {
            req.flash("success", "Event deleted successfully.");
        }

        res.redirect("/dashboard");
    });
});
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.redirect("/dashboard");
        }

        res.clearCookie("connect.sid"); 
        res.redirect("/login"); 
    });
});
app.get("/users", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login"); 
  }

  const sql = "SELECT username, email, role FROM users";

  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching users:", err);
      return res.status(500).send("Database error");
    }

    res.render("users.ejs", {
      users: results,
      currentEmail: req.session.user.email
    });
  });
});

app.post("/delete-user/:email", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login");
  }

  const emailToDelete = req.params.email;

  const sql = "DELETE FROM users WHERE email = ? AND role = 'user'"; 
  connection.query(sql, [emailToDelete], (err, result) => {
    if (err) {
      console.error("Error deleting user:", err);
      return res.status(500).send("Database error");
    }

    res.redirect("/users");
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
