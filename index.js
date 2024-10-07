import express from "express";
import expressEjsLayouts from "express-ejs-layouts";
import UserHandler from "./app/userHandler,js"; 
import session from "express-session"
import successHTTP from "./app/successHTTP.js";
import Addresses from "./app/Addresses.js";
import getMessageAndSuccess from "./app/getMessageAndSuccess.js";
import checkPermission from "./app/checkPermission.js";
import checkAdminPermission from "./app/checkAdminPermission.js";
import ProductCategories from "./app/ProductCategories.js";
import nullOrUndefined from "./app/nullOrUndefined.js";
import fs from "fs";

const app = express();

app.set("view engine", "ejs");
app.use(expressEjsLayouts);
app.use(urlencoded({extended: true}));
app.use(express.static("assets"));
app.use(express.static("product-images"));

app.use(session());

app.use(session({
    secret: "asdf",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24*60*60*1000
    }
}));

const uh = new UserHandler();
const p = new Profile(); 
const a = new Addresses();
const pc = new ProductCategories();
const pr = new Products();

app.get("/", (req, res)=> {
    res.render("public/index", 
        {
            layout: "layouts/public_layout", 
            title: "Kezdőlap", 
            baseUrl: process.env.BASE_URL,
            page:"index",
            message:req.query.message ? req.query.message : ""
        }
    );
});

app.post("/regisztracio", async (req, res)=> {
    let response;
    try {
        response = await uh.register(req.body); 
    } catch (err) {
        response = err;
    }

    //response.success = response.status.toString(0) === "2";
    response.success = successHTTP(response.status);
    res.status(response.status);

    res.render("public/register_post", {
        layout: "./layout/public_layout",
        message: response.message,
        title: "Regisztráció",
        baseUrl: process.env.BASE_URL,
        page: "regisztracio", 
        success: response.success
    })
});

app.post("/login", async (req, res)=> {
    let response;
    let path;

    try{
        response = uh.login(req.body);
        req.session.userName = response.message.userName;
        req.session.userID = response.message.userID;
        req.session.isAdmin = response.message.isAdmin;

        path = response.message.isAdmin == 0 ? "/user/profil" : "/admin/profil"
    } catch(err) {
        response = err;
    }

    response.success = successHTTP(response.status);


    res.status(response.status).redirect(
        response.success ? path : `/bejelentkezes?message=${response.message[0]}`
    )

})

app.get("/bejelentkezes", (req, res)=> {
    res.render("public/login", {
        layout: "./layouts/public_layout",
        title: "Bejelentkezés",
        baseUrl: process.env.BASE_URL,
        page: "bejelentkezes",
        message: req.query.message ? req.query.message : ""
    })
});

app.get("/user/profil", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const profileData = await p.getProfile(req.session.userID);
        //const messages = req.query.messages.split(",");
        /*
            Mert a getProfile függvény vár egy id-t és az alapján lehozza az összes (*) adatot, ahhoz az id-ű rekordhoz 
        */
        //csináltunk egy segédfüggvényt
        const messageAndSuccess = getMessageAndSuccess(req.query);
        
        res.render("user/profile", {
            layout: "./layouts/user_layout",
            title: "Profil Szerkesztése",
            baseUrl: process.env.BASE_URL,
            profileData: profileData.message, //itt meg megszerezzük az összes mezőt az adatbázisból 
            page: "profil", 
            message: messageAndSuccess.message,
            success: messageAndSuccess.success
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.post("/user/profil", async (req, res)=> {
    let response;

    try {
        const user = req.body;
        user.userID = req.session.userID;
        response = await p.updateProfile(user);
    } catch(err) {
        response = err;
    }

    console.log(response);

        
    const success = successHTTP(response.status);
    res.redirect(`/user/profil?success=${success}&messages=${response.message}`);
});

app.get("/user/cim-letrehozasa", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const addressTypes = await a.getAddressTypes();
        const messageAndSuccess = getMessageAndSuccess(req.query);
    
        res.render("user/create_address", {
            layout: "./layouts/user_layout", 
            title: "Címek létrehozása", 
            page: "címek",
            addressTypes: addressTypes,
            baseUrl: process.env.BASE_URL,
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            address:{}
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    } 
   
});

app.post("/user/create_address", async (req, res)=> {
    //itt szedjük majd le az adatokat 
    let response;

    try {
        response = await a.createAddress(req.body, req.session.userID);
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.status);

    if(success) {
        res.status(response.status).redirect(`/user/cim-letrehozasa/${response.insertID}?message=${response.message}&success=${success}`);
    } else {
        res.status(response.status).redirect(`/user/cim-letrehozasa?message=${response.message}&success=${success}`);
    }
    
});

app.get("/user/cim-letrehozasa:addressID", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const addressTypes = await a.getAddressTypes();
        const messageAndSuccess = getMessageAndSuccess(req.query);
        const address = await a.getAddressByID(req.params.addressID, req.session.userID);
        console.log(address);
    
        res.render("user/create_address", {
            layout: "./layouts/user_layout", 
            title: "Címek létrehozása", 
            baseUrl: process.env.BASE_URL,
            page: "címek",
            addressTypes: addressTypes,
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            address:address
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    } 
});

app.post()

app.get("/user/címek", async (req, res)=> {
    let response;

    try {
        checkPermission(req.session.userID),
        response = await a.getAddressesByUser(req.session.userID);
    } catch(err) {
        if(err.status === 403) {
            res.redirect(`/message=${err.message}`);
        }
        response = err;
    }

    res.render("user/addresses", { 
        layout: ".layout/user_layout",
        addresses: response.message,
        baseUrl: process.env.BASE_URL,
        title: "Címek", 
        page: "címek"
    })
});

app.post("user/create-address/:addressID", async (req, res)=> {
    let response;

    try {
        const address = req.body;
        address.addressID = req.params.addressID;
        response = await a.updateAddress(address, req.session.userID);
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    res.redirect(`/user/cim-letrehozasa/${req.params.addressID}?message=${response.message}&success=${success}`);
    /*
        fontos, hogy azokat ami egy url változó query, azt ?xx=xx formátumba kell csinálni   
    */
})

app.get("/admin/profil", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );
        const profileData = await p.getProfile(req.session.userID);
        const messageAndSuccess = getMessageAndSuccess(req.query);
        
        res.render("admin/profile", {
            layout: "./layouts/admin_layout",
            title: "Profil Szerkesztése",
            baseUrl: process.env.BASE_URL,
            profileData: profileData.message, //itt meg megszerezzük az összes mezőt az adatbázisból 
            page: "profil", 
            message: messageAndSuccess.message,
            success: messageAndSuccess.success
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.get("/admin/felhasznalok", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );

        const users = await uh.search(
            req.session.userID,
            req.session.isAdmin
        )
        
        res.render("admin/users", {
            layout: "./layouts/admin_layout",
            title: "Felhasználok",
            baseUrl: process.env.BASE_URL,
            profileData: users.message,
            page: "felhasznalok", 
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.get("/admin/termek-kategoriak", async (req, res)=> {
    try {
        // checkAdminPermission(
        //     req.session.userID,
        //     req.session.isAdmin
        // );

        const categories = await pc.getProductCategories(
            // req.session.userID,
            // req.session.isAdmin
        )
        
        res.render("admin/product-categories", {
            layout: "./layouts/admin_layout",
            title: "Termék kategóriák",
            baseUrl: process.env.BASE_URL,
            categories: categories,
            page: "termek-kategoriak"
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.get("/admin/termek-kategoria", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );

        const messageAndSuccess = getMessageAndSuccess(req.query);
        
        res.render("admin/product-category", {
            layout: "./layouts/admin_layout",
            title: "Termék kategória",
            baseUrl: process.env.BASE_URL,
            page: "termek-kategoria", 
            categoryData: null,
            message: messageAndSuccess.message,
            success: messageAndSuccess.success
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.post("admin/create-category", async (req, res)=> {
    let response;

    try {
        response = await pc.createCategory(
            req.body,
            req.session.userID,
            req.session.isAdmin
        )
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    if(success) {
        res.redirect(`/admin/termek-kategoria/${response.insertID}?message=${response.message}&success=${success}`);
    } else {
        res.redirect(`/admin/termek-kategoria/?message=${response.message}&success=${success}`);
    }
});

app.get("/admin/termek-kategoria/:categoryID", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );

        const categoryData = await pc.getCategoryByID(req.params.categoryID);
        /*
            fontos, hogy itt ha response [0][0], akkor azt az egyet kapjuk meg, ami nekünk kell 
            async getCategoryByID(categoryID) {
                 try {
                    const response = await conn.promise().query(
                    "SELECT * FROM product_categories WHERE categoryID = ?"
                    [categoryID]
                    );
                return response[0][0];                        *****
        */

        const messageAndSuccess = getMessageAndSuccess(req.query);
        
        res.render("admin/product-category", {
            layout: "./layouts/admin_layout",
            title: "Termék kategória",
            baseUrl: process.env.BASE_URL,
            page: "termek-kategoria", 
            categoryData:categoryData, 
            message: messageAndSuccess.message,
            success: messageAndSuccess.success
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.post("admin/create-category/:categoryID", async (req, res)=> {
    let response;

    try {

        const categoryData = req.body;
        categoryData.categoryID = req.params.categoryID;
        response = await pc.updateCategory(
            categoryData,
            req.session.userID,
            req.session.isAdmin
        )
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    // if(success) {
    //     res.redirect(`/admin/termek-kategoria/${response.insertID}?message=${response.message}&success=${success}`);
    // } else {
    //     res.redirect(`/admin/termek-kategoria/?message=${response.message}&success=${success}`);
    // }
    //itt nem úgy fogunk eljárni, mert nem response.insertID, hanem req.params.category, ahonnan meg van a szám!! 

    res.redirect(`/admin/termek-kategoria/${req.params.categoryID}/?message=${response.message}&success=${success}`);
});

app.post("/admin/delete-category/:categoryID", async (req, res)=> {
    let response;

    try {
        response = await pc.deleteCategory(
            req.params.categoryID,
            req.session.userID,
            req.session.isAdmin
        );
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    res.redirect(`/admin/termek-kategoriak/?message=${response.message}&success=${success}`);
});

//fontos, hogy nincsen még példányunk a Product-ból -> const pr = new Products();
app.get("/admin/termek", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );
    
        /*
            Itt nekünk kell a productCategory
            Ez nagyon fontos, mert ha nincs itt productCategory, akkor nem tudjuk kiválasztani a termék kategóriákat, ilyen legördülősben 
            -> 
        */
        const categories = await pc.getProductCategories()
        /*
            majd amit itt megkapunk termék kategóriákat, azokat át kell adni a render-nek, mert ott majd egy forEach-vel végig kell menni rajtuk!!
        */
        const messageAndSuccess = getMessageAndSuccess(req.query);
        
        res.render("admin/product", {
            layout: "./layouts/admin_layout",
            title: "Termék létrehozása",
            baseUrl: process.env.BASE_URL,
            page: "termek", 
            categories: categories,           //***
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            productData: null         
        })
    } catch(err) {
        console.log(err);
        res.redirect(`/?message=${err.message}`);
    }
});

app.post("/admin/create-product", async (req, res)=> {
    let response;

    try {
        response = await pr.createProduct(
            req.body,
            req.session.userID,
            req.session.isAdmin
        );
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    if(success) {
        res.redirect(`/admin/termek/${response.insertID}?message=${response.message}&success=${success}`);
    } else {
        res.redirect(`/admin/termek?message=${response.message}&success=${success}`);
    }
});

app.get("/admin/termek/:productID", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );

        const categories = await pc.getProductCategories()
        const messageAndSuccess = getMessageAndSuccess(req.query);
        const productData = await pr.getProductByID(req.params.productID);

        res.render("admin/product", {
            layout: "./layouts/admin_layout",
            title: "Termék létrehozása",
            baseUrl: process.env.BASE_URL,
            page: "termek", 
            categories: categories, 
            message: messageAndSuccess.message,
            success: messageAndSuccess.success, 
            productData: productData          
        })
    } catch(err) {
        console.log(err);
        res.redirect(`/?message=${err.message}`);
    }
});

app.post("/admin/create-product/:productID", async (req, res)=> {
    let response;

    try {
        req.body.productID = req.params.productID;
        //hogy a body-ban legyen benne a productID is! 
        response = await pr.updateProduct(
            req.body,
            req.session.userID,
            req.session.isAdmin
        );
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    res.redirect(`/admin/termek/${req.params.productID}?message=${response.message}&success=${success}`);
});

app.get("/admin/termekek", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );
    
        const products = await pr.getProducts();
        const messageAndSuccess = getMessageAndSuccess(req.query);
        
        res.render("admin/products", {
            layout: "./layouts/admin_layout",
            title: "Termékek",
            baseUrl: process.env.BASE_URL,
            page: "termekek",            
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            products: products    
        })
    } catch(err) {
        console.log(err);
        res.redirect(`/?message=${err.message}`);
    }
});

app.post("/admin-upload-product-image/:productID", async (req, res) => {
    // POST kérés az "/admin-upload-product-image/:productID" endpoint-ra, ahol :productID a feltöltött képhez tartozó termék azonosítója

    const form = formidable();
    // Új formidable űrlapot hozunk létre, hogy kezelni tudjuk a beérkező fájlokat és mezőket

    let fields;
    let files;
    // Létrehozunk két változót a mezők és a fájlok tárolására

    form.uploadDir = "./product-images";
    // Meghatározzuk, hogy melyik könyvtárba töltse fel a fájlokat (./product-images)

    form.keepExtension = true;
    // Beállítjuk, hogy a fájlok eredeti kiterjesztése megmaradjon (pl. .jpeg, .png)

    try {
        //const filePath = await pr.getFilePath(request.params.productID);
        //megnézzük itt, hogy fel van-e töltve már kép, de ezt kiszerveztük egy függvényben Products.js deleteProductImage
        await pr.deleteProductImage(req.params.productID, req.session.userID, req.session.isAdmin);

        if(fs.existsSync())
        [fields, files] = await form.parse(req);
        // Az await segítségével feldolgozzuk a beérkező kérést, és az űrlap adatait (mezőket és fájlokat) eltároljuk a `fields` és `files` változókban
        
        const oldPath = files.productImage[0].filepath;
        // Megkapjuk a feltöltött fájl jelenlegi (ideiglenes) útvonalát, ahol a rendszer tárolja (oldPath)
        
        const newPath = form.uploadDir + "/" + files.productImage[0].originalFileName;
        // Létrehozzuk az új elérési utat, ahová a fájlt átnevezzük és áthelyezzük (newPath). Az új fájlnév az eredeti fájlnév marad
        
        await fs.promises.rename(oldPath, newPath);
        // A fájl áthelyezése az ideiglenes tárolóból a végleges helyére (./product-images könyvtárba)

        await pr.updateFilePath(req.params.productID, files.productImage[0].originalFileName, req.session.userID, req.session.isAdmin);
        // A fájl elérési útvonalát frissítjük az adatbázisban, a termék azonosítója alapján (productID)

        res.redirect(`/admin/termekek/${req.params.productID}`);
        // Sikeres feltöltés esetén átirányítjuk az admin felületre, a termék oldalára

    } catch(err) {
        console.log(err);
        // Hibakezelés, ha hiba történik, akkor a hibát kiírjuk a konzolra

        const message = err.message || ["A fájl feltöltése sikertelen!"];
        
        res.status(err.status || 400).redirect(`/admin/termekek/${req.params.productID}?message=${message}&success=false`);
        // Ha hiba történt, visszaküldjük a kliensnek, hogy mi volt a probléma, és egy 400-as státuszkódot adunk vissza
        //és elírányítjuk a redirect-vel
    }
});
/*
    1. egy POST kérés érkezis a fájlfeltöltési URL-re 
    2. a formidable könyvtárat használjuk a fájlok és mezők kezelésére 
    3. a fájl egy ideiglenes mappába kerül, majd átnevezzük és athelyezzük a végleges könyvtárba!!!!!!
    4. Az új fájl elérési útvonalát frissitjük az adatbázisban, hogy a feltöltött kép a megfelelő termékhez tartozzon!!!!! 
    5. Ha hiba történt, akkor kezeljük és visszajelzést küldünk a felhasználónak 
    6. Siker esetén átírányítjuk az admin felületre, ahol a termék megtekinthető 

*/

app.post("/admin/delete-product-image/:productID", async (req, res) => {
    // POST kérés az "/admin/delete-product-image/:productID" endpoint-ra, ahol :productID a termék azonosítója,
    // és a termékhez tartozó kép törlésére szolgál

    try {
        const filePath = await pr.getFilePath(req.params.productID);
        // Lekérdezzük a fájl elérési útját az adatbázisból (productID alapján), amely a termékhez tartozó kép helyét adja vissza

        const fullPath = "./product/images/" + filePath;//leírás alul, hogy miért hoztuk létre ezt a változót 

        if (!nullOrUndefined(filePath) && fs.existsSync(fullPath)) {
            //Ha a filePath nem null vagy undefined, és a fájl valóban létezik a fájlrendszerben
            // Ha a fájl elérési útja létezik és a fájl ténylegesen megtalálható a ./product/images/ könyvtárban,
            await fs.promises.unlink(fullPath); //fontos, hogyha csak az fs van importálva, akkor kell a promises is elé!! 
            // Ha a fájl elérési útja nem null vagy undefined, akkor töröljük a fájlt a "./product/images/" mappából
            //ehhez mindig hozzá kell adni, hogy ./product/images/
        }

        //ki lett szervezve a függvénybe ami e felett van a try-ban szóval oda semmi se kell csak meghagyom 
        //és ezzel a függvénymeghívással (Products.js) meg van az csinálva ami itt van feljebb 
        const deleteMsg = await pr.deleteProductImage(req.params.productID, req.session.userID, req.session.isAdmin, true);


        await pr.updateFilePath(req.params.productID, null, req.session.userID, req.session.isAdmin);
        // Frissítjük az adatbázist úgy, hogy a termékhez tartozó fájl elérési útja (filePath) null lesz, jelezve, 
        //hogy nincs feltöltött kép
        //req.session.userID, req.session.isAdmin, mert csak azért van megadva, mert ott -> checkAdminPermission(userID, isAdmin);

        //pr.updateFilePath-ből csak egy response jön vissza és nem egy objektum, amiben van status meg message 
        //ezért itt csinálunk egy msg-t 
        const msg = deleteMsg || ["Sikeres feltöltés!"];

        //ha minden rendben ment, akkor meg ide akarjuk, hogy redirect-eljen minket
        res.redirect(`/admin/termek/${req.params.productID}?message=${msg}&success=true`);

    } catch (err) {
        //res.status(err.status || 400).send(["Hiba történt a fájl feltöltése közben!"]);
        // Hibakezelés: ha valami hiba történik, a megfelelő státuszkóddal (vagy 400-assal) visszaküldjük a hibaüzenetet a kliensnek
        res.status(err.status).redirect(`/admin/termek/${req.params.productID}?message=${err.message}&success=false`);
    }
});


app.listen(3000, console.log("the app is listening on localhost:3000"));

/*
    Products-on van egy egy form, ami egy POST lesz és ami itt fontos, hogy ENCTYPE="multipart/form-data" 
    Tehát itt töltjük fel a képet egy post kéréssel és az enctype miultipart/form-data azt jelenti, hogy ide többféle kiterjesztésű fájlt is 
    fel lehet majd tölteni!!! 

    <form class="box" method="POST" enctype="multipart/form-data"
    action="<%=baseUrl%/admin/peoduct-image/<%=productData.productID%>>">

        <input type="file" name="productImage">

        <button>Feltöltés</button>
    </form>

    Ami itt fontos 
    - csinálni kell majd egy POST-os kérést ide (majd a következőbe lesz benne, de ezt már megcsináltuk az előző órán)
        ami majd ide kell, ahova az action van -> "<%=baseUrl%/admin/peoduct-image/<%=productData.productID%>
    - enctype="multipart/form-data", hogy többféle típusú file-t (jpeg, stb..) is fel lehessen tölteni!!! 
    - az input-nak a type az, hogy file!!!!!! 

    Felette csináljuk azt, hogy megjelejen a kép, hogyha a productData létezik, tehát, ha már ki van töltve a form-unk, 
    csak azután tudunk egy képet feltölteni, hogy van termék név, cím, ár stb.. 

    <% if(productData) { %>
        <div>
            <img src="<%=baseUrl + productData.filePath%>">
        </div>
    <% } %>

    A filePath az amikor megadjuk, hogy hol van elmentve itt a kép (product-images) mappa 
    de hasonlóan, mint az assets, ahol statikus fájlok vannak ott kell ezt csinálni!! 
    ->
    app.use(express.static("product-images"));

    <img src="<%=baseUrl + productData.filePath%>">
    Ez így nem jó, mert nem kell, hogy product-images, mert így nem fog megjelenni a kép 
    de viszont az a probléma, hogy az adatbázisban így lett elmentve a kép a filePath mezőben, hogy 
    /product-images/valami.jpeg
 
    így néz ki most a post-os kérés itt 
    ->
    app.post("/admin-upload-product-image/:productID", async (req, res)=> {
    const form = formidable();
    let fields;
    let files;

    form.uploadDir = "./product-images"; //melyik könyvtárba töltse fel a dolgokat 
    form.keepExtension = true; //hogyha feltöltünk egy jpeg file-t akkor megmaradjon a kiterjesztése (extension) továbbra is jpeg maradjon!! 

    try {
        [fields, files] = await form.parse(req);//itt kapjuk meg a beérkező form-ot 
        const oldPath = files.productImage[0].filepath;
        const newPath = form.uploadDir + "/" + files.productImage[0].originalFileName;
        await fs.promises.rename(oldPath, newPath);
        await pr.updateFilePath(req.params.productID, newPath.substring(1));    ******
        ->
        await pr.updateFilePath(req.params.productID, files.productImage[0].originalFileName) 
    } catch(err) {
        console.log(err);

        res.status(err.httpCode || 400).send(["Hiba történt a file feltöltése közben!"])
        return;
    }

    res.redirect(`/admin/termekek/${req.params.productID}`);
})

    Mivel az elöző probléma miatt kellene nekünk nem a newPath hanem ez files.productImage[0].originalFileName és akkor nem lesz benne 
    az adatbázisban az, hogy /product-images!! 
    await pr.updateFilePath(req.params.productID, newPath.substring(1));    ******
        ->
    await pr.updateFilePath(req.params.productID, files.productImage[0].originalFileName) 

    tehát most így jó már a product.ejs-en 
    <% if(productData) { %>
        <div class="admin-product-img">
            <img src="<%=baseUrl%><%=productData.filePath%>">
        </div>
    <% } %>
    mert ugye az adatbázisban van egy olyan mező ahova betettük a képet ez a ProductData-ban meg fogjuk kapni és ezt meg itt megjelenítjük 
    ezen az oldalon, hogy product.ejs, ahol fel tudjuk vinni a termékeket, meg felülírni őket 
    most megcsináljuk a class-t amit adtunk a div-nek a style.css-ben 
        .admin-product-img {
            width: 350px;
            height: 350px;
            margin: 15px auto;
        }

        .admin-product-img img {
            width: 350px;
            height: 350px;
            object-fit: cover;
        }

    <% if(productData && productData.filePath) { %>
        <div class="admin-product-imm">
            <img src="<%=baseUrl%><%=productData.filePath%>">
        </div>
    <% } %>

    <% if(productData) { %>
        <form class="box" method="POST" enctype="multipart/form-data"
        action="<%=baseUrl%/admin/peoduct-image/<%=productData.productID%>>">
    
            <input type="file" name="productImage">
    
            <button>Feltöltés</button>
        </form>
    <% } %>

    Ehhez kellene egy törlés funkció, hogy ki tudjuk törölni a képet 
    ->
    .admin-product-img {
        width: 350px;
        height: 350px;
        margin: 15px auto;
        position: relative;   **** 
        elöször is a div-nek amiben benne van a kép annak relative kell lennie, mert majd rárakunk egy button-t (absolute)
    }
    
    ezt az osztályt kapja meg majd a button 
        .position-absolute-btn {
            position: absolute;
            //hogy középen legyen vízszintesen 
            left: 0;
            right: 0;
            margin: auto;
            bottom: 15px;  //hogy 15px-el a kép aljától felfele legyen!! 
            width: 100px;
        }

    <% if(productData && productData.filePath) { %>
        <div class="admin-product-img">
            <img src="<%=baseUrl%><%=productData.filePath%>">

            <button class="position-absolute-btn">Törlés</button>   ***** ezt a button tettük rá a képre, amivel majd törölni tudunk 
        </div>
    <% } %>

    És ha megnyomjuk a törlés gombot, akkor le kellene törölnünk ezt a bizonyos képet!! 
    de ehhez az egésznek egy form-ban kellene, hogy legyen (átnevezzük a div-et egy form-ra) ->
    -> 
        <% if(productData && productData.filePath) { %>
        <form class="admin-product-img">
            <img src="<%=baseUrl%><%=productData.filePath%>">

            <button class="position-absolute-btn">Törlés</button>
        </form>
    <% } %>

    Ide kell egy input, nagyon fontos, hogy a type-ja hidden legyen tehát ne lássuk
        és a value-ja meg az legyen productID!!! 
    -> 
        <% if(productData && productData.filePath) { %>
        <form class="admin-product-img">
            <img src="<%=baseUrl%><%=productData.filePath%>">

            <input type="hidden" value="<%=productData.productID%>"> *****************************

            <button class="position-absolute-btn">Törlés</button>
        </form>
    <% } %>
    És ebben az esetben ott is van, hogy value="4"-es 

    megcsináljuk a form-nak, hogy mi legyen a method-ja meg a action-je 
    ->
    <form method="POST" action="<%=baseUrl%/admin/delete-product-image/<%=productData.productID%>" class="admin-product-img">
    Mert a productID alapján tudjuk meg, hogy melyik terméknek a képe 
    Most ha rákattintanánk, akkor azt mondaná, hogy nincs ilyen endpoint, de viszont ha van egy képünk és nem töröljük le csak 
    az input-val, amivel feltöltünk egy új képet ott megadunk egy újat és meg is fog változni a képünk
    Megcsináljuk itt a post-os kérésünket meg Products.js-ben is kell majd egy függvény (getFilePath)
    
    async getFilePath(productID) {
        try {
            const response = await conn.promise().query(
                `SELECT filePath FROM products WHERE productID = ?`,
                [productID]
            )

            if(response[0].length > 0) {
                return response[0][0].filePath
            } else {
                throw {
                    status: 404,
                    message: ["A keresett termék nem található!"]
                }
            }

    Ha végignézzük az egész folyamatot ez a form amivel törölni akarunk (product.ejs) 
    ez elküld minket ide ->
    action="<%=baseUrl%/admin/delete-product-image/<%=productData.productID%>">
    aminek itt készítettünk egy endpoint-ot ->
    app.post("/admin/delete-product-image/:productID", async (req, res) => {

    response-ot csak innen kapunk majd vissza 
    -> await pr.updateFilePath(req.params.productID, null, req.session.userID, req.session.isAdmin);
    és ha minden rendben ment, akkor csinálunk egy redirect-et -> 
    
    app.post("/admin/delete-product-image/:productID", async (req, res) => {
    // POST kérés az "/admin/delete-product-image/:productID" endpoint-ra, ahol :productID a termék azonosítója,
    // és a termékhez tartozó kép törlésére szolgál

    try {
        const filePath = await pr.getFilePath(req.params.productID);
        // Lekérdezzük a fájl elérési útját az adatbázisból (productID alapján), amely a termékhez tartozó kép helyét adja vissza

        if (!nullOrUndefined(filePath && fs.existsSync(filePath))) { 
            await fs.promises.unlink("./product/images/" + filePath);  
            // Ha a fájl elérési útja nem null vagy undefined, akkor töröljük a fájlt a "./product/images/" mappából
        }

        await pr.updateFilePath(req.params.productID, null, req.session.userID, req.session.isAdmin);
        // Frissítjük az adatbázist úgy, hogy a termékhez tartozó fájl elérési útja (filePath) null lesz, jelezve, 
        //hogy nincs feltöltött kép
        //req.session.userID, req.session.isAdmin, mert csak azért van megadva, mert ott -> checkAdminPermission(userID, isAdmin);

        //pr.updateFilePath-ből csak egy response jön vissza és nem egy objektum, amiben van status meg message 
        //ezért itt csinálunk egy msg-t 
        const msg = ["Sikeres feltöltés!"];

        //ha minden rendben ment, akkor meg ide akarjuk, hogy redirect-eljen minket
        res.redirect(`/admin/termek/${req.params.productID}?message=${msg}&success=true`);

    } catch (err) {
        //res.status(err.status || 400).send(["Hiba történt a fájl feltöltése közben!"]);
        // Hibakezelés: ha valami hiba történik, a megfelelő státuszkóddal (vagy 400-assal) visszaküldjük a hibaüzenetet a kliensnek
        res.status(err.status || 400).redirect(`/admin/termek/${req.params.productID}?message=${err.message}&success=false`);
    }
});

Tehát itt két dolgot kell csinálni
1. meg kell szerezni, hogy mi a filePath (ez a getFilePath függvény itt van felette)
const filePath = await pr.getFilePath(req.params.productID);
->
Lekérdezzük a fájl elérési útját az adatbázisból (productID alapján), amely a termékhez tartozó kép helyét adja vissza

2. töröljük a file-t a product-images mappából -> 
    if (!nullOrUndefined(filePath) && fs.existsSync(filePath)) {
        await fs.promises.unlink("./product/images/" + filePath); 

3.. töröljük a képet az adatbázisból is
    await pr.updateFilePath(req.params.productID, null, req.session.userID, req.session.isAdmin);
-> 
Frissítjük az adatbázist úgy, hogy a termékhez tartozó fájl elérési útja (filePath) null lesz, jelezve, hogy nincs feltöltött kép

Ez meg az updateFilePath függvény 
->
    async updateFilePath(productID, filePath, userID, isAdmin) {
        checkAdminPermission(userID, isAdmin);
        
        try {
            const response = await conn.promise().query(
                `UPDATE products SET filePath = ? WHERE productID = ?`,
                [filePath.trim(), productID]
            )

            if (response[0].affectedRows > 0) {
                return {
                    status: 200,
                    message: ["Sikeres feltöltés!"]
                }
            } else {
                throw {
                    status: 404,
                    message: ["A termék nem taláható!"]
                }
            }

    Tehát az a lényeg az adatbázisban, hogy az ottani valami.png helyett az legyen, hogy null
    ezt csináljuk ezzel az updateFilePath-val, mert az bekér egy filePath-ot amit set-el és ennek a meghívásánál meg ezt NULL-ra set-eljük 
    -> 
    await pr.updateFilePath(req.params.productID, null, req.session.userID, req.session.isAdmin);

    És ami nagyon fontos változtatás, hogy csak akkor trim()-elünk, hogyha létezik, tehát kell a kérdőjel 
    mert ha ennek az értéke null, akkor nem tudunk/akarunk trim-elni 
    ->
    async updateFilePath(productID, filePath, userID, isAdmin) {
        checkAdminPermission(userID, isAdmin);

        try {
            const response = await conn.promise().query(
                `UPDATE products SET filePath = ? WHERE productID = ?`,
                [filePath?**************.trim(), productID] 
            )

    Tehát itt ugye ez null azért mert ki van törölve a file, amire nem lehet meghívni a trim-et

    És így már sikeresen törölve van innen is a file meg az adatbázisban is NULL lett az értéke 
    Fel is tudunk vinni egy újat és azt is törölni 

    de ez még nem jó, már más elérési útvonal van ezek között -> fs.existsSync(filePath) és fs.promises.unlink("./product/images/" + filePath)
    az egyiknél oda van írva a /product-images a másiknál meg nem!!! 
    if (!nullOrUndefined(filePath) && fs.existsSync(filePath)) {
        await fs.promises.unlink("./product/images/" + filePath);

    mert ha ez le tudta törölni fs.promises.unlink("./product/images/" + filePath);
    akkor miért mondta azt, hogy ez létezik (fs.existsSync(filePath))), tehát nem is kellet volna tudni ide bejönni 
    vagy ha be tudunk, akkor meg az unlink nem kénne, hogy letörölje 

    Nem törölte le, mert nem is jöttünk be ide az if-ágba!!! 

    ezért csinálunk egy olyan változót, hogy fullPath, aminek megadjuk ezt -> "./product/images/" + filePath) és majd ezt írjuk be mindenhova
    ->
    const fullPath = "./product/images/" + filePath;

    if (!nullOrUndefined(filePath) && fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);

    És akkor már így tényleg nem is jelenítődik meg a képernyőn és a nem is lesz benne a product-images könyvtárba

    Csinálunk egy olyat, hogy deleteProductImage a Products.js-en, hogy majd ezt meg lehessen hívni mindkét postban ami itt van 
    és ne itt csináljuk meg az index-en 
    -> 


    De viszont van egy olyan probléma, hogyha feltöltünk egy újat, úgyhogy nem töröltük azt ami eddig fent volt, akkor az ott fog maradni a 
    product-images-ben (mi meg azt akarjuk, hogy ott csak az legyen ami jelenleg fel van töltve)
    -> 
    Az updateFilePath ahol meg van hívva, ott meg kell nézni, hogy ennek a terméknek létezik-e már képe 
    Ezt meg tudjuk nézni a productID-ból 

    async deleteProductImage(productID, userID, isAdmin) {
    checkAdminPermission(userID, isAdmin);
        try {
            const filePath = await this.getFilePath(productID); 
            //fontos, hogyha itt egy másik függvény van meghívva, ami itt van a class-ban, akkor a this-vel hívatkozunk rá
            const fullPath = "./product-images/" + filePath;

    
                if(fs.existsSync(fullPath)) {
                    await fs.promises.unlink(fullPath);
                } else { 
                    //és itt dobunk egy olyan hobát, hogy a file nem található 
                    throw {
                        status: 403, 
                        message: ["A törölni kiívánt fájl nem található!"]
                    }
                }

    És akkor ha ezt ide kiszerveztük egy függvénybe az admin/delete-product-image/:productID-nál 
    csak meg kell hívni ezt a függvényt és onnan ki lehet törölni ami már nem kell 

    app.post("/admin/delete-product-image/:productID", async (req, res) => {
    await pr.deleteProductImage(req.params.productID, req.session.userID, req.session.isAdmin);

    és az upload-product-image-nél is ugyanezt a függvényt meghívjuk 

    De az a gond, hogy filefeltöltésnél is dobnánk egy ilyen hibát, hogyha nem látja a régi képet, mert mondjuk még nem volt kép 
        throw {
            status: 403, 
            message: ["A törölni kiívánt fájl nem található!"]
        }

    Ezért kell egy negyedik paraméter a deleteProductImage függvénynek, hogy isUpload, ami alap esetben false 
        async deleteProductImage(productID, userID, isAdmin, isUpload = false***********) {
        checkAdminPermission(userID, isAdmin);

        try {
            const filePath = await this.getFilePath(productID); 
            //fontos, hogyha itt egy másik függvény van meghívva, ami itt van a class-ban, akkor a this-vel hívatkozunk rá
            const fullPath = "./product-images/" + filePath;
                if(fs.existsSync(fullPath)) {
                    await fs.promises.unlink(fullPath);
                } else if(!isUpload) { ********* 
                     throw {
                        status: 403, 
                        message: ["A törölni kiívánt fájl nem található!"]
                        }

    És mivel ez alapból false, ezért csak a upload-product-nél kell megadni, hogy true, mert akkor nem megyünk oda be 
    hogy hibát, dobjon, mert ott tagadva van, else if(!isUpload), tehát ha true, akkor nem megy be!!!!!! 
    ->
    await pr.deleteProductImage(req.params.productID, req.session.userID, req.session.isAdmin, true);

    Azt kell megoldani, hogyha van egy kép vagy akár nem is fontos, hogy legyen és nincs is kiválasztva kép amit fel akarunk tölteni 
    és úgy megyünk rá a feltöltés gombra (tehát ha üres volt a file input)
    jelenleg, akkor elvisz minket ide, hogy localhost:3000/admin/upload-product-image/4
    és kiírja, hogy ["Hiba történt a fájl feltöltése közben"]

    mert akkor itt az upload-product-image-nél bemegyünk ebbe az ágba, hogy 
    res.status(err.status || 400).send(["Hiba történt a file feltöltése közben!"]);

    Tehát a redirect az bele kell, hogy kerüljön a try ágba
    nem a try-catch ág után csinálni, ahogy eddig volt, naggyából ugyanúgy megcsináljuk, mint a delete-product-image-nél van ez a rész 

    try {
    ....
        res.redirect(`/admin/termekek/${req.params.productID}`);*********
        // Sikeres feltöltés esetén átirányítjuk az admin felületre, a termék oldalára

    } catch(err) {
        console.log(err);
        // Hibakezelés, ha hiba történik, akkor a hibát kiírjuk a konzolra

        const message = err.message || ["A fájl feltöltése sikertelen!"]; ***********
        res.status(err.status || 400).redirect(`/admin/termekek/${req.params.productID}?message=${message}&success=false`); ***********

        Ennek az elmagyarázása, ami itt van a catch ágban 
        const message = err.message || ["A fájl feltöltése sikertelen!"];
        1. err.message
        Ez a hibához tartozó konkrét üzenet, amit az err objektumból próbálunk elérni 
            ha van ilyen üzenet, akkor azt használja 

        2. || (logikai vagy)
        Ez a müvelet azt jelenti, hogy ha az első érték (err.message) undefined vagy null vagy egyébként falsy érték (pl.üres string)
            akkor a második értéket fogja használni 

        3. ["A fájl feltöltése sikertelen!"]; 
        Ha nincs üzenet az err objektumban, akkor ez az alapértelmezett hibaüzenet lesz 

        Ha a catch blokkon belül valami hiba történik, és az err.message nem áll rendelkezésre, akkor ezt az üzenetet fogjuk kapni 
        Így az alkalmazás mindig küld valami hibaüzenetet!!!!!!!!!!!
    ************************************

        Ha csak rámegyünk a törlés gombra, akkor amikor nincsen feltöltve kép, akkor azt írja ki, hogy a törölni kivánt fájl nem található
        a delete-product-image-ben a 
        pr.deleteProductImage-nek le kellene futnia, meg a updateFilePath-nak is 
        Mert ha itt a deleteProductImage-ben dobunk egy hibát 
        ->
        else if(!isUpload) { 
                throw {
                    status: 403, 
                    message: ["A törölni kívánt fájl nem található!"]
                }
            } 
    Akkor nem fogja nekünk felülírni NULL-ra az értéket és akkor mindig itt lesz ez 
    Tehát ha nincs meg a file, mert már alapból le volt törölve, de ezt végülis nem érdekes és nem csináljuk meg 
    és mivel ez nem fog lefutni -> await pr.updateFilePath(req.params.productID, null*******, req.session.userID, req.session.isAdmin);
    ezért az adatbázisban nem update-li null-ra!!!! 
    
    ezért itt egy sima return-t fogunk nem egy throw-t 
                } else if(!isUpload) { 
                return {
                    status: 403, 
                    message: ["A törölni kívánt fájl nem található!"]
                }

    és ez meg nem kell a catch-ben mert feltételezhetően sosem lesz status 
    ez nem kell 
    -> 
            if(err.status) {
                throw err;
            }

    itt meg ahol meghívjuk a deleteProductImage-t azt elmentjük egy deleteMsg változóba, mert most már ezt visszakapjuk (return !!!!)
                return {
                    status: 403, 
                    message: ["A törölni kívánt fájl nem található!"]
                }

    const deleteMsg = await pr.deleteProductImage(req.params.productID, req.session.userID, req.session.isAdmin, true);

    és még mindig a try-ban, ahol van egy msg változónk ->
    const msg = ["Sikeres feltöltés!"];
    ->
    const msg = deleteMsg || ["Sikeres feltöltés!"];



*/

